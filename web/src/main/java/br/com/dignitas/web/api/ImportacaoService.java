package br.com.dignitas.web.api;

import br.com.dignitas.extraction.ImportPipeline;
import br.com.dignitas.extraction.OcrEngine;
import br.com.dignitas.extraction.OcrMode;
import br.com.dignitas.extraction.TessdataManager;
import br.com.dignitas.model.ExamInfo;
import br.com.dignitas.model.QuestionDraft;
import br.com.dignitas.service.AlreadyImportedException;
import br.com.dignitas.service.ImportService;
import br.com.dignitas.service.QuestionService;
import br.com.dignitas.service.Dtos.ImportRow;
import br.com.dignitas.service.Dtos.SaveSummary;
import br.com.dignitas.web.api.Dtos.AlternativaDetalhe;
import br.com.dignitas.web.api.Dtos.ConfirmarImportacaoRequest;
import br.com.dignitas.web.api.Dtos.ImportacaoConfirmada;
import br.com.dignitas.web.api.Dtos.ImportacaoPrevia;
import br.com.dignitas.web.api.Dtos.ImportacaoQuestao;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Importação de prova em duas etapas: a prévia extrai as questões e as guarda pendentes no servidor;
 * a confirmação grava só as selecionadas. A prévia não grava nada no banco.
 */
@Service
public class ImportacaoService {

    private static final Duration VALIDADE_PREVIA = Duration.ofHours(1);

    private record Pendente(String arquivo, String hash, int paginas, int paginasOcr,
                            List<QuestionDraft> questoes, List<String> avisos, Instant criadaEm) {
    }

    private final Map<String, Pendente> pendentes = new ConcurrentHashMap<>();
    private final ImportPipeline pipeline;
    private final ImportService importacoes;
    private final QuestionService questoes;
    private final Path tessdataDir;

    public ImportacaoService(ImportPipeline pipeline, ImportService importacoes, QuestionService questoes,
                             Path tessdataDir) {
        this.pipeline = pipeline;
        this.importacoes = importacoes;
        this.questoes = questoes;
        this.tessdataDir = tessdataDir;
    }

    public ImportacaoPrevia previa(MultipartFile arquivo, MultipartFile gabarito, OcrMode modo) throws IOException {
        if (arquivo == null || arquivo.isEmpty()) throw new IllegalArgumentException("Escolha um arquivo PDF.");
        String nome = arquivo.getOriginalFilename() == null ? "prova.pdf" : arquivo.getOriginalFilename();
        if (!nome.toLowerCase().endsWith(".pdf")) throw new IllegalArgumentException("O arquivo precisa ser um PDF.");

        removerExpiradas();
        Path tmp = Files.createTempFile("dignitas-prova-", ".pdf");
        Path tmpGabarito = gabarito == null || gabarito.isEmpty() ? null : Files.createTempFile("dignitas-gabarito-", ".pdf");
        try {
            arquivo.transferTo(tmp);
            if (tmpGabarito != null) gabarito.transferTo(tmpGabarito);

            OcrEngine ocr = motorOcr(modo);
            ImportPipeline.Result r = pipeline.run(tmp.toFile(),
                    tmpGabarito == null ? null : tmpGabarito.toFile(),
                    modo, ocr, (feitas, total, msg) -> { }, () -> false);

            ImportRow existente = importacoes.findByFileHash(r.fileHash()).orElse(null);
            if (existente != null) throw new AlreadyImportedException(existente);

            List<String> avisos = new ArrayList<>(r.warnings());
            Set<String> repetidas = questoes.existingHashes(r.questions().stream()
                    .map(QuestionDraft::contentHash).toList());
            Pendente p = new Pendente(nome, r.fileHash(), r.pageCount(), r.ocrPages(),
                    r.questions(), avisos, Instant.now());
            pendentes.put(r.fileHash(), p);

            List<ImportacaoQuestao> itens = new ArrayList<>();
            for (int i = 0; i < r.questions().size(); i++) {
                QuestionDraft d = r.questions().get(i);
                itens.add(new ImportacaoQuestao(i, d.getNumber(), d.getSubjectName(), d.getStatement(),
                        d.getAlternatives().stream()
                                .map(a -> new AlternativaDetalhe(0, a.getLetter(), a.getText(), a.isCorrect()))
                                .toList(),
                        d.getConfidence(),
                        repetidas.contains(d.contentHash()),
                        d.validate()));
            }
            return new ImportacaoPrevia(r.fileHash(), nome, r.pageCount(), r.ocrPages(), avisos, itens);
        } finally {
            Files.deleteIfExists(tmp);
            if (tmpGabarito != null) Files.deleteIfExists(tmpGabarito);
        }
    }

    public ImportacaoConfirmada confirmar(String id, ConfirmarImportacaoRequest req) {
        Pendente p = pendentes.get(id);
        if (p == null) throw new NoSuchElementException("Prévia não encontrada ou expirada. Envie o arquivo novamente.");

        // Gabaritos informados na revisão: a letra enviada passa a ser a única correta da questão
        if (req.gabaritos() != null) {
            req.gabaritos().forEach((indice, letra) -> {
                QuestionDraft d = indiceValido(p, indice);
                d.getAlternatives().forEach(a -> a.setCorrect(a.getLetter().equalsIgnoreCase(letra)));
            });
        }

        List<QuestionDraft> escolhidas = new ArrayList<>();
        for (Integer i : req.indices()) {
            QuestionDraft d = indiceValido(p, i);
            if (d.validate().isEmpty()) escolhidas.add(d);
        }
        if (escolhidas.isEmpty()) throw new IllegalArgumentException("Nenhuma questão válida foi selecionada.");

        ExamInfo concurso = new ExamInfo(req.concurso(), req.banca(), req.ano(), null);
        SaveSummary resumo = importacoes.save(concurso, p.arquivo(), p.hash(), p.paginas(), p.paginasOcr(), escolhidas);
        pendentes.remove(id);
        return new ImportacaoConfirmada(resumo.saved(), req.indices().size() - resumo.saved());
    }

    private static QuestionDraft indiceValido(Pendente p, Integer indice) {
        if (indice == null || indice < 0 || indice >= p.questoes().size()) {
            throw new IllegalArgumentException("Índice de questão inválido: " + indice);
        }
        return p.questoes().get(indice);
    }

    public List<ImportRow> listar() {
        return importacoes.list();
    }

    public void excluir(long id) {
        importacoes.delete(id);
    }

    /** Sem OCR quando o modo pede só texto ou quando o idioma português do Tesseract não está instalado. */
    private OcrEngine motorOcr(OcrMode modo) {
        if (modo == OcrMode.TEXT_ONLY) return null;
        TessdataManager tessdata = new TessdataManager(tessdataDir);
        if (!tessdata.isInstalled()) {
            if (modo == OcrMode.ALWAYS) {
                throw new IllegalArgumentException("OCR indisponível: o idioma português do Tesseract não está instalado em "
                        + tessdataDir + ".");
            }
            return null;
        }
        return new OcrEngine(tessdataDir);
    }

    private void removerExpiradas() {
        Instant limite = Instant.now().minus(VALIDADE_PREVIA);
        pendentes.values().removeIf(p -> p.criadaEm().isBefore(limite));
    }
}
