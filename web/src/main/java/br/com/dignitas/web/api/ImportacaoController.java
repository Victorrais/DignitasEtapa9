package br.com.dignitas.web.api;

import br.com.dignitas.extraction.OcrMode;
import br.com.dignitas.service.Dtos.ImportRow;
import br.com.dignitas.web.api.Dtos.ConfirmarImportacaoRequest;
import br.com.dignitas.web.api.Dtos.ImportacaoConfirmada;
import br.com.dignitas.web.api.Dtos.ImportacaoPrevia;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/importacoes")
public class ImportacaoController {

    private final ImportacaoService importacoes;

    public ImportacaoController(ImportacaoService importacoes) {
        this.importacoes = importacoes;
    }

    /** Etapa 1: extrai as questões do PDF e devolve a prévia para revisão. Não grava nada. */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    ImportacaoPrevia previa(@RequestParam("arquivo") MultipartFile arquivo,
                            @RequestParam(value = "gabarito", required = false) MultipartFile gabarito,
                            @RequestParam(value = "ocr", defaultValue = "AUTO") OcrMode ocr) throws IOException {
        return importacoes.previa(arquivo, gabarito, ocr);
    }

    /** Etapa 2: grava as questões selecionadas da prévia. */
    @PostMapping("/{id}/confirmar")
    ImportacaoConfirmada confirmar(@PathVariable String id, @Valid @RequestBody ConfirmarImportacaoRequest req) {
        return importacoes.confirmar(id, req);
    }

    @GetMapping
    List<ImportRow> listar() {
        return importacoes.listar();
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void excluir(@PathVariable long id) {
        importacoes.excluir(id);
    }
}
