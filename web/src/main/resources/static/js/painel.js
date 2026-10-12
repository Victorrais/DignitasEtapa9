/* Painel: números gerais, últimas respostas e acerto por disciplina, vindos da API. */
document.addEventListener('DOMContentLoaded', async function () {
    const { api, regras, ui } = Dignitas;

    try {
        const [est, marcadas, ultimas] = await Promise.all([
            api.estatisticas(),
            api.listarQuestoes({ situacao: 'marcadas', tamanho: 1 }),
            api.historico({ tamanho: 5 })
        ]);
        const geral = est.visaoGeral;
        document.getElementById('st-questoes').textContent = geral.questions;
        document.getElementById('st-respondidas').textContent = geral.answeredQuestions;
        document.getElementById('st-acerto').textContent = ui.percentual(regras.precisao(geral.correctAttempts, geral.attempts));
        document.getElementById('st-marcadas').textContent = marcadas.total;

        const lista = document.getElementById('ultimas');
        if (ultimas.items.length === 0) {
            lista.innerHTML = '<li class="empty">Nenhuma resposta ainda. <a href="praticar.html">Comece a praticar</a>.</li>';
        } else {
            lista.innerHTML = ultimas.items.map(function (t) {
                return '<li><span class="badge ' + (t.correct ? 'badge-ok">Certa' : 'badge-error">Errada') + '</span>'
                    + '<a href="praticar.html?id=' + t.questionId + '">' + ui.escapar(t.statement) + '</a>'
                    + '<small>' + ui.dataHora(t.answeredAt) + '</small></li>';
            }).join('');
        }

        const alvo = document.getElementById('por-disciplina');
        if (est.porDisciplina.length === 0) {
            alvo.innerHTML = '<p class="empty">As taxas aparecem depois das primeiras respostas.</p>';
        } else {
            alvo.innerHTML = est.porDisciplina.map(function (d) {
                const p = regras.precisao(d.correct, d.attempts);
                return '<div class="linha-barra"><div class="linha-barra-topo"><span>' + ui.escapar(d.name) + '</span>'
                    + '<strong>' + ui.percentual(p) + '</strong></div>'
                    + '<div class="bar"><span style="width:' + Math.round(p * 100) + '%"></span></div></div>';
            }).join('');
        }
    } catch (e) {
        ui.aviso(e.message);
    }
});
