package br.com.dignitas.web.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Testes de API para questões (IT-03 a IT-05, IT-09, IT-10, IT-14 do plano de testes). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class QuestaoApiTest {

    @Autowired
    MockMvc mvc;

    /** Corpo de uma questão válida com enunciado único (evita colisão com outros testes). */
    private static String questao(String enunciado, int correta) {
        StringBuilder alts = new StringBuilder();
        String[] letras = {"A", "B", "C", "D", "E"};
        for (int i = 0; i < letras.length; i++) {
            if (i > 0) alts.append(',');
            alts.append("{\"letra\":\"").append(letras[i]).append("\",\"texto\":\"Alternativa ").append(letras[i])
                    .append("\",\"correta\":").append(i == correta).append('}');
        }
        return "{\"enunciado\":\"" + enunciado + "\",\"disciplina\":\"Matemática\",\"banca\":\"Vunesp\","
                + "\"ano\":2023,\"concurso\":\"Prefeitura " + enunciado.hashCode() + "\",\"anulada\":false,"
                + "\"alternativas\":[" + alts + "]}";
    }

    @Test
    void criaQuestaoValidaERetornaId() throws Exception {
        String enunciado = "Quanto é 7 vezes 8? " + UUID.randomUUID();
        mvc.perform(post("/api/questoes").contentType(MediaType.APPLICATION_JSON).content(questao(enunciado, 1)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", greaterThan(0)));
    }

    @Test
    void recusaQuestaoSemAlternativaCorreta() throws Exception {
        String sem = "{\"enunciado\":\"Sem gabarito\",\"alternativas\":["
                + "{\"letra\":\"A\",\"texto\":\"x\",\"correta\":false},{\"letra\":\"B\",\"texto\":\"y\",\"correta\":false}]}";
        mvc.perform(post("/api/questoes").contentType(MediaType.APPLICATION_JSON).content(sem))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detalhes[0]", org.hamcrest.Matchers.containsString("correta")));
    }

    @Test
    void recusaQuestaoRepetida() throws Exception {
        String enunciado = "Capital do Brasil " + UUID.randomUUID();
        mvc.perform(post("/api/questoes").contentType(MediaType.APPLICATION_JSON).content(questao(enunciado, 0)))
                .andExpect(status().isCreated());
        // mesmo conteúdo, com outra caixa e sem acentos: é a mesma questão para o sistema
        String repetida = questao(enunciado.toUpperCase().replace("Ã", "A"), 0);
        mvc.perform(post("/api/questoes").contentType(MediaType.APPLICATION_JSON).content(repetida))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro", org.hamcrest.Matchers.containsString("mesmo conteúdo")));
    }

    @Test
    void listaComFiltroDeTextoEPaginacao() throws Exception {
        String marca = "Termo" + UUID.randomUUID().toString().substring(0, 8);
        mvc.perform(post("/api/questoes").contentType(MediaType.APPLICATION_JSON).content(questao(marca + " um", 2)))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/questoes").param("texto", marca).param("tamanho", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total", greaterThan(0)))
                .andExpect(jsonPath("$.items", hasSize(greaterThan(0))));
    }

    @Test
    void buscaDetalheComGabaritoEEditaQuestao() throws Exception {
        String enunciado = "Editar questão " + UUID.randomUUID();
        String resposta = mvc.perform(post("/api/questoes").contentType(MediaType.APPLICATION_JSON)
                        .content(questao(enunciado, 0)))
                .andReturn().getResponse().getContentAsString();
        long id = Long.parseLong(resposta.replaceAll("\\D", ""));

        mvc.perform(get("/api/questoes/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.alternativas", hasSize(5)))
                .andExpect(jsonPath("$.alternativas[0].correta").value(true));

        mvc.perform(put("/api/questoes/" + id).contentType(MediaType.APPLICATION_JSON)
                        .content(questao(enunciado + " revisado", 3)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enunciado", org.hamcrest.Matchers.endsWith("revisado")));
    }

    @Test
    void marcaParaRevisaoEExclui() throws Exception {
        String resposta = mvc.perform(post("/api/questoes").contentType(MediaType.APPLICATION_JSON)
                        .content(questao("Marcar e excluir " + UUID.randomUUID(), 4)))
                .andReturn().getResponse().getContentAsString();
        long id = Long.parseLong(resposta.replaceAll("\\D", ""));

        mvc.perform(patch("/api/questoes/" + id + "/marcacao").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"marcada\":true}"))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/questoes/" + id)).andExpect(jsonPath("$.marcada").value(true));

        mvc.perform(delete("/api/questoes/" + id)).andExpect(status().isNoContent());
        mvc.perform(get("/api/questoes/" + id)).andExpect(status().isNotFound());
    }

    @Test
    void sorteioNaoExpoeGabarito() throws Exception {
        mvc.perform(post("/api/questoes").contentType(MediaType.APPLICATION_JSON)
                        .content(questao("Sorteio " + UUID.randomUUID(), 1)))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/questoes/sorteio"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.alternativas[0].correta").doesNotExist());
    }
}
