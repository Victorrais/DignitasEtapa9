package br.com.dignitas.web.api;

import br.com.dignitas.domain.Alternative;
import br.com.dignitas.domain.Question;
import br.com.dignitas.model.BaseTextDraft;
import br.com.dignitas.model.ExamInfo;
import br.com.dignitas.model.QuestionDraft;
import br.com.dignitas.service.CatalogService;
import br.com.dignitas.service.QuestionService;
import br.com.dignitas.service.Dtos.PageResult;
import br.com.dignitas.service.Dtos.QuestionFilter;
import br.com.dignitas.service.Dtos.QuestionRow;
import br.com.dignitas.service.Dtos.Sort;
import br.com.dignitas.service.Dtos.Status;
import br.com.dignitas.web.api.Dtos.AlternativaDetalhe;
import br.com.dignitas.web.api.Dtos.AlternativaPratica;
import br.com.dignitas.web.api.Dtos.CriadaResposta;
import br.com.dignitas.web.api.Dtos.MarcacaoRequest;
import br.com.dignitas.web.api.Dtos.QuestaoDetalhe;
import br.com.dignitas.web.api.Dtos.QuestaoPratica;
import br.com.dignitas.web.api.Dtos.QuestaoRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Random;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/questoes")
public class QuestaoController {

    private final QuestionService questoes;
    private final CatalogService catalogo;
    private final Random sorteio = new Random();

    public QuestaoController(QuestionService questoes, CatalogService catalogo) {
        this.questoes = questoes;
        this.catalogo = catalogo;
    }

    @GetMapping
    PageResult<QuestionRow> listar(@RequestParam(required = false) String texto,
                                   @RequestParam(required = false) String disciplina,
                                   @RequestParam(required = false) String banca,
                                   @RequestParam(required = false) Integer ano,
                                   @RequestParam(defaultValue = "todas") String situacao,
                                   @RequestParam(defaultValue = "recentes") String ordem,
                                   @RequestParam(defaultValue = "0") int pagina,
                                   @RequestParam(defaultValue = "5") int tamanho) {
        return questoes.search(filtro(texto, disciplina, banca, ano, situacao, ordem), Math.max(0, pagina), limitar(tamanho));
    }

    /** Sorteia uma questão para resolver, sem repetir a informada em {@code excetoId}. */
    @GetMapping("/sorteio")
    QuestaoPratica sortear(@RequestParam(required = false) String disciplina,
                           @RequestParam(required = false) Long excetoId) {
        QuestionFilter f = filtro(null, disciplina, null, null, "todas", "recentes");
        List<Long> ids = questoes.ids(f);
        List<Long> candidatas = ids.stream().filter(id -> !id.equals(excetoId)).toList();
        List<Long> base = candidatas.isEmpty() ? ids : candidatas;
        if (base.isEmpty()) throw new NoSuchElementException("Nenhuma questão encontrada.");
        return praticar(questoes.loadFull(base.get(sorteio.nextInt(base.size()))));
    }

    @GetMapping("/{id}")
    QuestaoDetalhe buscar(@PathVariable long id) {
        return detalhe(questoes.loadFull(id));
    }

    /** Questão para resolver, sem o gabarito. */
    @GetMapping("/{id}/pratica")
    QuestaoPratica praticarPorId(@PathVariable long id) {
        return praticar(questoes.loadFull(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    CriadaResposta criar(@Valid @RequestBody QuestaoRequest req) {
        return new CriadaResposta(questoes.save(paraRascunho(null, req)));
    }

    @PutMapping("/{id}")
    QuestaoDetalhe atualizar(@PathVariable long id, @Valid @RequestBody QuestaoRequest req) {
        questoes.save(paraRascunho(id, req));
        return detalhe(questoes.loadFull(id));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void excluir(@PathVariable long id) {
        questoes.delete(id);
    }

    @PatchMapping("/{id}/marcacao")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void marcar(@PathVariable long id, @RequestBody MarcacaoRequest req) {
        questoes.setFlagged(id, req.marcada());
    }

    // ---------- Conversões ----------

    private QuestionFilter filtro(String texto, String disciplina, String banca, Integer ano,
                                  String situacao, String ordem) {
        Long subjectId = null;
        if (disciplina != null && !disciplina.isBlank()) {
            subjectId = catalogo.subjects().stream()
                    .filter(s -> s.getName().equalsIgnoreCase(disciplina.strip()))
                    .map(s -> s.getId())
                    .findFirst()
                    .orElse(-1L); // disciplina inexistente: nenhuma questão corresponde
        }
        return new QuestionFilter(texto, subjectId, banca, ano, null, status(situacao), sort(ordem), false);
    }

    private static Status status(String situacao) {
        return switch (situacao) {
            case "nao-respondidas" -> Status.UNANSWERED;
            case "erradas" -> Status.WRONG;
            case "marcadas" -> Status.FLAGGED;
            default -> Status.ALL;
        };
    }

    private static Sort sort(String ordem) {
        return switch (ordem) {
            case "antigas" -> Sort.OLDEST;
            case "numero" -> Sort.NUMBER;
            default -> Sort.RECENT;
        };
    }

    private static int limitar(int tamanho) {
        return Math.min(100, Math.max(1, tamanho));
    }

    /** Monta o rascunho que o núcleo valida e grava (mesma regra da tela Java). */
    private static QuestionDraft paraRascunho(Long id, QuestaoRequest req) {
        QuestionDraft d = new QuestionDraft();
        d.setId(id);
        d.setNumber(req.numero());
        d.setExam(new ExamInfo(req.concurso(), req.banca(), req.ano(), null));
        d.setSubjectName(req.disciplina());
        if (req.textoBase() != null && !req.textoBase().isBlank()) {
            d.setBaseText(new BaseTextDraft(null, req.textoBase(), null));
        }
        d.setStatement(req.enunciado() == null ? "" : req.enunciado());
        d.setAnnulled(req.anulada());
        if (req.alternativas() != null) {
            req.alternativas().forEach(a -> d.addAlternative(a.letra(), a.texto(), a.correta()));
        }
        return d;
    }

    private static QuestaoDetalhe detalhe(Question q) {
        return new QuestaoDetalhe(
                q.getId(), q.getNumber(),
                q.getBaseText() == null ? null : q.getBaseText().getContent(),
                q.getStatement(),
                q.getSubject() == null ? null : q.getSubject().getName(),
                q.getExam() == null ? null : q.getExam().getName(),
                q.getExam() == null ? null : q.getExam().getBoard(),
                q.getExam() == null ? null : q.getExam().getYear(),
                q.isAnnulled(), q.isFlagged(),
                q.getAlternatives().stream()
                        .map(a -> new AlternativaDetalhe(a.getId(), a.getLetter(), a.getStatement(), a.isAnswer()))
                        .toList());
    }

    private static QuestaoPratica praticar(Question q) {
        return new QuestaoPratica(
                q.getId(), q.getNumber(),
                q.getBaseText() == null ? null : q.getBaseText().getContent(),
                q.getStatement(),
                q.getSubject() == null ? null : q.getSubject().getName(),
                q.getExam() == null ? null : q.getExam().getName(),
                q.getExam() == null ? null : q.getExam().getBoard(),
                q.getExam() == null ? null : q.getExam().getYear(),
                q.isAnnulled(), q.isFlagged(),
                q.getAlternatives().stream()
                        .map(a -> new AlternativaPratica(a.getId(), a.getLetter(), a.getStatement()))
                        .toList());
    }
}
