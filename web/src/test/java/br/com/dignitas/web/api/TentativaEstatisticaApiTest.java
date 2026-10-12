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
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Testes de API para respostas, histórico, estatísticas e catálogo (IT-06 a IT-08, IT-13 do plano). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TentativaEstatisticaApiTest {

    @Autowired
    MockMvc mvc;

    private long criarQuestao(String enunciado, int correta) throws Exception {
        String alts = "";
        String[] letras = {"A", "B", "C", "D", "E"};
        for (int i = 0; i < letras.length; i++) {
            alts += (i > 0 ? "," : "") + "{\"letra\":\"" + letras[i] + "\",\"texto\":\"Opção " + letras[i]
                    + "\",\"correta\":" + (i == correta) + "}";
        }
        String corpo = "{\"enunciado\":\"" + enunciado + "\",\"disciplina\":\"Geografia\",\"banca\":\"FGV\","
                + "\"ano\":2022,\"concurso\":\"IBGE\",\"alternativas\":[" + alts + "]}";
        String r = mvc.perform(post("/api/questoes").contentType(MediaType.APPLICATION_JSON).content(corpo))
                .andReturn().getResponse().getContentAsString();
        return Long.parseLong(r.replaceAll("\\D", ""));
    }

    @Test
    void respostaCertaEErradaSaoCorrigidas() throws Exception {
        long id = criarQuestao("Resposta " + UUID.randomUUID(), 2);

        mvc.perform(post("/api/tentativas").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"questaoId\":" + id + ",\"letra\":\"C\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.correct").value(true))
                .andExpect(jsonPath("$.correctLetter").value("C"));

        mvc.perform(post("/api/tentativas").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"questaoId\":" + id + ",\"letra\":\"A\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.correct").value(false));
    }

    @Test
    void letraInexistenteEhRecusada() throws Exception {
        long id = criarQuestao("Letra " + UUID.randomUUID(), 0);
        mvc.perform(post("/api/tentativas").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"questaoId\":" + id + ",\"letra\":\"Z\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void historicoFiltraPorResultado() throws Exception {
        long id = criarQuestao("Histórico " + UUID.randomUUID(), 4);
        mvc.perform(post("/api/tentativas").contentType(MediaType.APPLICATION_JSON)
                .content("{\"questaoId\":" + id + ",\"letra\":\"E\"}"));
        mvc.perform(post("/api/tentativas").contentType(MediaType.APPLICATION_JSON)
                .content("{\"questaoId\":" + id + ",\"letra\":\"B\"}"));

        mvc.perform(get("/api/tentativas").param("resultado", "erradas"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].correct", hasItem(false)));
        mvc.perform(get("/api/tentativas").param("resultado", "certas"))
                .andExpect(jsonPath("$.items[*].correct", org.hamcrest.Matchers.not(hasItem(false))));
    }

    @Test
    void estatisticasEstaoDisponiveis() throws Exception {
        mvc.perform(get("/api/estatisticas"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visaoGeral.attempts", greaterThan(-1)))
                .andExpect(jsonPath("$.diario", org.hamcrest.Matchers.hasSize(7)));
    }

    @Test
    void catalogoListaDisciplinasEBancas() throws Exception {
        criarQuestao("Catálogo " + UUID.randomUUID(), 0);
        mvc.perform(get("/api/catalogo"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.disciplinas", hasItem("Geografia")))
                .andExpect(jsonPath("$.bancas", hasItem("FGV")));
    }

    @Test
    void importacaoRecusaArquivoQueNaoEPdf() throws Exception {
        org.springframework.mock.web.MockMultipartFile txt = new org.springframework.mock.web.MockMultipartFile(
                "arquivo", "notas.txt", "text/plain", "abc".getBytes());
        mvc.perform(multipart("/api/importacoes").file(txt))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.erro", org.hamcrest.Matchers.containsString("Dados")));
    }
}
