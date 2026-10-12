package br.com.dignitas.web.config;

import br.com.dignitas.extraction.ImportPipeline;
import br.com.dignitas.service.AttemptService;
import br.com.dignitas.service.CatalogService;
import br.com.dignitas.service.ImportService;
import br.com.dignitas.service.QuestionService;
import br.com.dignitas.service.StatsService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.nio.file.Path;

/** Registra os serviços do núcleo como beans do Spring, sem anotar as classes do núcleo. */
@Configuration
public class ServicosConfig {

    @Bean
    QuestionService questionService() {
        return new QuestionService();
    }

    @Bean
    CatalogService catalogService() {
        return new CatalogService();
    }

    @Bean
    AttemptService attemptService() {
        return new AttemptService();
    }

    @Bean
    StatsService statsService() {
        return new StatsService();
    }

    @Bean
    ImportService importService() {
        return new ImportService();
    }

    @Bean
    ImportPipeline importPipeline() {
        return new ImportPipeline();
    }

    /** Diretório dos modelos do Tesseract (idioma português). */
    @Bean
    Path tessdataDir(@Value("${dignitas.tessdata-dir}") String dir) {
        return Path.of(dir);
    }
}
