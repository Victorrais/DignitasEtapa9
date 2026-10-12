package br.com.dignitas.web.api;

import br.com.dignitas.service.CatalogService;
import br.com.dignitas.service.StatsService;
import br.com.dignitas.web.api.Dtos.Catalogo;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Leituras agregadas: estatísticas e listas de referência para os filtros e formulários. */
@RestController
@RequestMapping("/api")
public class EstatisticaCatalogoController {

    private final StatsService estatisticas;
    private final CatalogService catalogo;

    public EstatisticaCatalogoController(StatsService estatisticas, CatalogService catalogo) {
        this.estatisticas = estatisticas;
        this.catalogo = catalogo;
    }

    @GetMapping("/estatisticas")
    Map<String, Object> estatisticas() {
        return Map.of(
                "visaoGeral", estatisticas.overview(),
                "porDisciplina", estatisticas.bySubject(),
                "porBanca", estatisticas.byBoard(),
                "diario", estatisticas.daily(7));
    }

    @GetMapping("/catalogo")
    Catalogo catalogo() {
        return new Catalogo(
                catalogo.subjects().stream().map(s -> s.getName()).toList(),
                catalogo.boards(),
                catalogo.years());
    }
}
