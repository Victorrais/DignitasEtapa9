package br.com.dignitas.web.api;

import br.com.dignitas.domain.Alternative;
import br.com.dignitas.domain.Question;
import br.com.dignitas.service.AttemptService;
import br.com.dignitas.service.QuestionService;
import br.com.dignitas.service.Dtos.AnswerResult;
import br.com.dignitas.service.Dtos.HistoryRow;
import br.com.dignitas.service.Dtos.PageResult;
import br.com.dignitas.service.Dtos.ResultFilter;
import br.com.dignitas.web.api.Dtos.RespostaRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/tentativas")
public class TentativaController {

    private final AttemptService tentativas;
    private final QuestionService questoes;

    public TentativaController(AttemptService tentativas, QuestionService questoes) {
        this.tentativas = tentativas;
        this.questoes = questoes;
    }

    /** Registra a resposta. A letra é convertida para a alternativa do banco antes de gravar. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    AnswerResult responder(@Valid @RequestBody RespostaRequest req) {
        Question q = questoes.loadFull(req.questaoId());
        Alternative escolhida = q.getAlternatives().stream()
                .filter(a -> a.getLetter().equalsIgnoreCase(req.letra()))
                .findFirst()
                .orElseThrow(() -> new NoSuchElementException("Alternativa " + req.letra() + " não existe nesta questão."));
        return tentativas.answer(q.getId(), escolhida.getId());
    }

    @GetMapping
    PageResult<HistoryRow> historico(@RequestParam(required = false) String texto,
                                     @RequestParam(defaultValue = "todas") String resultado,
                                     @RequestParam(defaultValue = "0") int pagina,
                                     @RequestParam(defaultValue = "20") int tamanho) {
        ResultFilter filtro = switch (resultado) {
            case "certas" -> ResultFilter.CORRECT;
            case "erradas" -> ResultFilter.WRONG;
            default -> ResultFilter.ALL;
        };
        return tentativas.history(texto, filtro, Math.max(0, pagina), Math.min(100, Math.max(1, tamanho)));
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void limparHistorico() {
        tentativas.deleteAll();
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void excluir(@PathVariable long id) {
        tentativas.deleteAttempt(id);
    }
}
