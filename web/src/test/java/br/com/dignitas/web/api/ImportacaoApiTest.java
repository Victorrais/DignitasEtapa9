package br.com.dignitas.web.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Confirmação da importação: prévia inexistente e corpo inválido (IT-11 e IT-12 do plano). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ImportacaoApiTest {

    @Autowired
    MockMvc mvc;

    @Test
    void confirmarPreviaInexistenteRetorna404() throws Exception {
        mvc.perform(post("/api/importacoes/nao-existe/confirmar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"concurso\":\"TRF 1\",\"indices\":[0]}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void confirmarSemIndicesRetorna400() throws Exception {
        mvc.perform(post("/api/importacoes/qualquer/confirmar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"concurso\":\"TRF 1\"}"))
                .andExpect(status().isBadRequest());
    }
}
