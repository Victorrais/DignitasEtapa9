package br.com.dignitas.web.api;

import br.com.dignitas.service.AlreadyImportedException;
import br.com.dignitas.service.DuplicateQuestionException;
import br.com.dignitas.web.api.Dtos.ApiErro;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.NoSuchElementException;

/** Converte as exceções do núcleo e da validação em respostas HTTP com corpo JSON único. */
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ApiErro> dadosInvalidos(IllegalArgumentException e) {
        return erro(HttpStatus.BAD_REQUEST, "Dados inválidos.", quebrar(e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiErro> validacao(MethodArgumentNotValidException e) {
        List<String> detalhes = e.getBindingResult().getAllErrors().stream()
                .map(err -> err instanceof FieldError fe ? fe.getField() + ": " + fe.getDefaultMessage() : err.getDefaultMessage())
                .toList();
        return erro(HttpStatus.BAD_REQUEST, "Dados inválidos.", detalhes);
    }

    @ExceptionHandler(DuplicateQuestionException.class)
    ResponseEntity<ApiErro> duplicada() {
        return erro(HttpStatus.CONFLICT, "Já existe uma questão com o mesmo conteúdo.", List.of());
    }

    @ExceptionHandler(AlreadyImportedException.class)
    ResponseEntity<ApiErro> jaImportado(AlreadyImportedException e) {
        return erro(HttpStatus.CONFLICT, "Este arquivo já foi importado.", List.of());
    }

    @ExceptionHandler(NoSuchElementException.class)
    ResponseEntity<ApiErro> naoEncontrado(NoSuchElementException e) {
        return erro(HttpStatus.NOT_FOUND, e.getMessage() == null ? "Registro não encontrado." : e.getMessage(), List.of());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ApiErro> arquivoGrande() {
        return erro(HttpStatus.PAYLOAD_TOO_LARGE, "O arquivo passa do limite de 25 MB.", List.of());
    }

    @ExceptionHandler(IOException.class)
    ResponseEntity<ApiErro> arquivoIlegivel(IOException e) {
        return erro(HttpStatus.UNPROCESSABLE_ENTITY, "Não foi possível ler o arquivo enviado.", List.of(e.getMessage()));
    }

    /** Banco não conectado (o núcleo lança IllegalStateException nesse caso). */
    @ExceptionHandler(IllegalStateException.class)
    ResponseEntity<ApiErro> bancoIndisponivel(IllegalStateException e) {
        return erro(HttpStatus.SERVICE_UNAVAILABLE, "Banco de dados indisponível.", List.of(e.getMessage()));
    }

    private static List<String> quebrar(String mensagem) {
        return mensagem == null ? List.of() : Arrays.asList(mensagem.split("\n"));
    }

    private static ResponseEntity<ApiErro> erro(HttpStatus status, String mensagem, List<String> detalhes) {
        return ResponseEntity.status(status).body(new ApiErro(mensagem, detalhes));
    }
}
