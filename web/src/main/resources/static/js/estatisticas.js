/* Estatísticas: totais, gráfico dos últimos 7 dias e acerto por disciplina e por banca, vindos da API. */
document.addEventListener('DOMContentLoaded', async function () {
    const { api, regras, ui } = Dignitas;

    function tabela(id, linhas) {
        const corpo = document.getElementById(id);
        if (linhas.length === 0) {
            corpo.innerHTML = '<tr><td colspan="4" class="empty">Sem respostas ainda.</td></tr>';
            return;
        }
        corpo.innerHTML = linhas.map(function (l) {
            const p = regras.precisao(l.correct, l.attempts);
            return '<tr><td>' + ui.escapar(l.name) + '</td>'
                + '<td class="num">' + l.attempts + '</td>'
                + '<td class="num">' + ui.percentual(p) + '</td>'
                + '<td><div class="bar"><span style="width:' + Math.round(p * 100) + '%"></span></div></td></tr>';
        }).join('');
    }

    function grafico(dias) {
        const maximo = Math.max(1, ...dias.map(function (d) { return d.attempts; }));
        document.getElementById('dias').innerHTML = dias.map(function (d) {
            const altura = Math.round(d.attempts / maximo * 100);
            const pAcertos = d.attempts ? d.correct / d.attempts * 100 : 0;
            // "day" chega como AAAA-MM-DD; criar a data com horário local evita o deslocamento de fuso
            const [ano, mes, dia] = d.day.split('-').map(Number);
            const rotulo = new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
            return '<div class="dia" title="' + d.attempts + ' respostas, ' + d.correct + ' acertos">'
                + '<strong>' + d.attempts + '</strong>'
                + '<div class="dia-coluna" style="height:' + altura + '%">'
                + '<span class="acertos" style="height:' + pAcertos + '%"></span>'
                + '<span class="erros" style="height:' + (d.attempts ? 100 - pAcertos : 0) + '%"></span>'
                + '</div><small>' + rotulo + '</small></div>';
        }).join('');
    }

    try {
        const est = await api.estatisticas();
        const g = est.visaoGeral;
        document.getElementById('e-tentativas').textContent = g.attempts;
        document.getElementById('e-acertos').textContent = g.correctAttempts;
        document.getElementById('e-erros').textContent = g.attempts - g.correctAttempts;
        document.getElementById('e-acerto').textContent = ui.percentual(regras.precisao(g.correctAttempts, g.attempts));
        grafico(est.diario);
        tabela('t-disciplina', est.porDisciplina);
        tabela('t-banca', est.porBanca);
    } catch (e) {
        ui.aviso(e.message);
    }
});
