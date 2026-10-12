/* Histórico: respostas registradas na API, com filtro por texto e por resultado. */
document.addEventListener('DOMContentLoaded', function () {
    const { api, regras, ui } = Dignitas;
    const corpo = document.getElementById('tabela');
    const texto = document.getElementById('h-texto');
    const resultado = document.getElementById('h-resultado');
    let versao = 0;

    async function desenhar() {
        const minha = ++versao;
        let res;
        try {
            res = await api.historico({
                texto: texto.value.trim().length >= 3 ? texto.value.trim() : '',
                resultado: resultado.value,
                tamanho: 50
            });
        } catch (e) {
            ui.aviso(e.message);
            return;
        }
        if (minha !== versao) return;

        document.getElementById('contagem').textContent = res.total + (res.total === 1 ? ' resposta' : ' respostas');
        if (res.items.length === 0) {
            corpo.innerHTML = '<tr><td colspan="5" class="empty">Nenhuma resposta encontrada. '
                + '<a href="praticar.html">Praticar agora</a>.</td></tr>';
            return;
        }
        corpo.innerHTML = res.items.map(function (t) {
            return '<tr>'
                + '<td>' + ui.dataHora(t.answeredAt) + '</td>'
                + '<td><a class="enunciado-curto" href="praticar.html?id=' + t.questionId + '">'
                + ui.escapar(t.statement) + '</a></td>'
                + '<td>' + ui.escapar(regras.rotuloConcurso(t.board, t.year, t.examName)) + '</td>'
                + '<td>' + ui.escapar(t.chosenLetter) + '</td>'
                + '<td><span class="badge ' + (t.correct ? 'badge-ok">Certa' : 'badge-error">Errada') + '</span></td>'
                + '</tr>';
        }).join('');
    }

    document.getElementById('form-filtros').addEventListener('input', desenhar);
    document.getElementById('form-filtros').addEventListener('submit', function (e) { e.preventDefault(); });

    document.getElementById('limpar').addEventListener('click', async function () {
        if (!confirm('Apagar todo o histórico de respostas? Esta ação não pode ser desfeita.')) return;
        try {
            await api.limparHistorico();
            ui.aviso('Histórico apagado.');
            desenhar();
        } catch (e) {
            ui.aviso(e.message);
        }
    });

    desenhar();
});
