package br.com.dignitas.web.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Contrato HTTP da API. Os tipos ficam separados das entidades JPA do núcleo. */
public final class Dtos {
    private Dtos() {
    }

    public record ApiErro(String erro, List<String> detalhes) {
    }

    // ---------- Entrada ----------

    public record AlternativaRequest(
            @NotBlank @Size(max = 1) String letra,
            @Size(max = 2000) String texto,
            boolean correta) {
    }

    public record QuestaoRequest(
            @Size(max = 5000) String textoBase,
            @Size(max = 2000) String enunciado,
            @Min(1) Integer numero,
            @Size(max = 120) String disciplina,
            @Size(max = 255) String concurso,
            @Size(max = 120) String banca,
            @Min(1950) @Max(2100) Integer ano,
            boolean anulada,
            @Valid @Size(max = 5) List<AlternativaRequest> alternativas) {
    }

    public record MarcacaoRequest(boolean marcada) {
    }

    public record RespostaRequest(@Min(1) long questaoId, @NotBlank @Size(max = 1) String letra) {
    }

    public record ConfirmarImportacaoRequest(
            @Size(max = 255) String concurso,
            @Size(max = 120) String banca,
            @Min(1950) @Max(2100) Integer ano,
            @NotBlank List<Integer> indices) {
    }

    // ---------- Saída ----------

    public record AlternativaDetalhe(long id, String letra, String texto, boolean correta) {
    }

    /** Questão para edição: inclui o gabarito. */
    public record QuestaoDetalhe(long id, Integer numero, String textoBase, String enunciado,
                                 String disciplina, String concurso, String banca, Integer ano,
                                 boolean anulada, boolean marcada, List<AlternativaDetalhe> alternativas) {
    }

    /** Questão para resolver: sem o gabarito, que só é revelado na resposta. */
    public record AlternativaPratica(long id, String letra, String texto) {
    }

    public record QuestaoPratica(long id, Integer numero, String textoBase, String enunciado,
                                 String disciplina, String concurso, String banca, Integer ano,
                                 boolean anulada, boolean marcada, List<AlternativaPratica> alternativas) {
    }

    public record CriadaResposta(long id) {
    }

    public record Catalogo(List<String> disciplinas, List<String> bancas, List<Integer> anos) {
    }

    public record ImportacaoQuestao(int indice, Integer numero, String disciplina, String enunciado,
                                    List<AlternativaDetalhe> alternativas, double confianca,
                                    boolean duplicada, List<String> erros) {
    }

    public record ImportacaoPrevia(String id, String arquivo, int paginas, int paginasOcr,
                                   List<String> avisos, List<ImportacaoQuestao> questoes) {
    }

    public record ImportacaoConfirmada(int salvas, int ignoradas) {
    }
}
