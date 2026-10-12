/* Lista de questões: filtros, ordenação, paginação e marcação para revisão, consultados na API. */
document.addEventListener('DOMContentLoaded', async function () {
    const { api, regras, ui } = Dignitas;
    const TAMANHO_PAGINA = 5;
    const form = document.getElementById('form-filtros');
    const campoTexto = document.getElementById('f-texto');
    const erroTexto = document.getElementById('erro-texto');
    const corpo = document.getElementById('tabela');
    const select = document.getElementById('f-disciplina');
    let pagina = 0;
    let versao = 0; // descarta respostas antigas quando o usuário muda o filtro depressa

    /** Busca com 1 ou 2 letras traria resultados demais e sem sentido: exige 3 ou mais. */
    function textoValido() {
        const t = campoTexto.value.trim();
        const ok = t.length === 0 || t.length >= 3;
        erroTexto.textContent = ok ? '' : 'Digite pelo menos 3 caracteres.';
        campoTexto.closest('.field').classList.toggle('invalid', !ok);
        campoTexto.setAttribute('aria-invalid', String(!ok));
        return ok;
    }

    function filtros() {
        return {
            texto: campoTexto.value.trim().length >= 3 ? campoTexto.value.trim() : '',
            disciplina: select.value,
            situacao: document.getElementById('f-status').value,
            ordem: document.getElementById('f-ordem').value,
            pagina: pagina,
            tamanho: TAMANHO_PAGINA
        };
    }

    async function desenhar() {
        if (!textoValido()) return;
        const minha = ++versao;
        let res;
        try {
            res = await api.listarQuestoes(filtros());
        } catch (e) {
            ui.aviso(e.message);
            return;
        }
        if (minha !== versao) return; // resposta de um filtro que já mudou

        const total = regras.paginas(res.total, TAMANHO_PAGINA);
        if (pagina >= total) { pagina = total - 1; return desenhar(); }

        document.getElementById('contagem').textContent =
            res.total + (res.total === 1 ? ' questão' : ' questões');
        document.getElementById('pagina-info').textContent = 'Página ' + (pagina + 1) + ' de ' + total;
        document.getElementById('anterior').disabled = pagina === 0;
        document.getElementById('proxima').disabled = pagina >= total - 1;

        if (res.items.length === 0) {
            corpo.innerHTML = '<tr><td colspan="5" class="empty">Nenhuma questão encontrada com esses filtros.</td></tr>';
            return;
        }
        corpo.innerHTML = res.items.map(function (q) {
            return '<tr>'
                + '<td class="num">' + (q.number || '—') + '</td>'
                + '<td><span class="enunciado-curto">' + ui.escapar(q.statement) + '</span>'
                + (q.annulled ? ' <span class="badge badge-warn">Anulada</span>' : '') + '</td>'
                + '<td>' + ui.escapar(q.subject || '—') + '</td>'
                + '<td>' + ui.escapar(regras.rotuloConcurso(q.board, q.year, q.examName)) + '</td>'
                + '<td><div class="acoes">'
                + '<a class="btn btn-small btn-primary" href="praticar.html?id=' + q.id + '">Resolver</a>'
                + '<button class="btn btn-small" type="button" data-marcar="' + q.id + '" data-marcada="' + q.flagged + '" aria-pressed="' + q.flagged + '">'
                + (q.flagged ? 'Desmarcar' : 'Marcar') + '</button>'
                + '</div></td></tr>';
        }).join('');
    }

    async function carregarDisciplinas() {
        const cat = await api.catalogo();
        cat.disciplinas.forEach(function (d) {
            const op = document.createElement('option');
            op.value = d;
            op.textContent = d;
            select.appendChild(op);
        });
    }

    form.addEventListener('input', function () { pagina = 0; desenhar(); });
    form.addEventListener('submit', function (e) { e.preventDefault(); desenhar(); });
    form.addEventListener('reset', function () { setTimeout(function () { pagina = 0; desenhar(); }); });
    document.getElementById('anterior').addEventListener('click', function () { pagina--; desenhar(); });
    document.getElementById('proxima').addEventListener('click', function () { pagina++; desenhar(); });

    corpo.addEventListener('click', async function (e) {
        const botao = e.target.closest('[data-marcar]');
        if (!botao) return;
        const marcar = botao.dataset.marcada !== 'true';
        try {
            await api.marcar(Number(botao.dataset.marcar), marcar);
            ui.aviso(marcar ? 'Questão marcada para revisão.' : 'Marcação removida.');
            desenhar();
        } catch (err) {
            ui.aviso(err.message);
        }
    });

    try {
        await carregarDisciplinas();
    } catch (e) {
        ui.aviso(e.message);
    }
    desenhar();
});
