/* Praticar: sorteia uma questão, registra a resposta na API e mostra o gabarito devolvido por ela. */
document.addEventListener('DOMContentLoaded', async function () {
    const { api, regras, ui } = Dignitas;
    const form = document.getElementById('form-resposta');
    const opcoes = document.getElementById('opcoes');
    const botaoResponder = document.getElementById('responder');
    const botaoMarcar = document.getElementById('marcar');
    const resultado = document.getElementById('resultado');
    const filtro = document.getElementById('p-disciplina');
    const sessao = { respondidas: 0, acertos: 0 };
    let atual = null;
    let respondida = false;
    let ocupado = false;

    function atualizarSessao() {
        const p = regras.precisao(sessao.acertos, sessao.respondidas);
        document.getElementById('s-respondidas').textContent = sessao.respondidas;
        document.getElementById('s-acerto').textContent = ui.percentual(p);
        document.getElementById('s-barra').style.width = Math.round(p * 100) + '%';
    }

    function mostrarMarcacao(marcada) {
        botaoMarcar.setAttribute('aria-pressed', String(marcada));
        botaoMarcar.textContent = marcada ? 'Desmarcar revisão' : 'Marcar para revisão';
    }

    function mostrar(q) {
        atual = q;
        respondida = false;
        resultado.hidden = true;
        opcoes.disabled = false;
        botaoResponder.disabled = true;

        if (!q) {
            document.getElementById('meta').innerHTML = '';
            document.getElementById('texto-base').hidden = true;
            document.getElementById('enunciado').textContent = 'Nenhuma questão para esta disciplina.';
            opcoes.innerHTML = '<legend class="visually-hidden">Alternativas</legend>';
            botaoMarcar.disabled = true;
            return;
        }
        botaoMarcar.disabled = false;

        document.getElementById('meta').innerHTML =
            '<span class="badge badge-accent">' + ui.escapar(q.disciplina || 'Sem disciplina') + '</span>'
            + '<span class="badge">' + ui.escapar(regras.rotuloConcurso(q.banca, q.ano, q.concurso)) + '</span>'
            + (q.numero ? '<span class="badge">Questão ' + q.numero + '</span>' : '')
            + (q.anulada ? '<span class="badge badge-warn">Anulada</span>' : '');

        const textoBase = document.getElementById('texto-base');
        textoBase.hidden = !q.textoBase;
        textoBase.textContent = q.textoBase || '';
        document.getElementById('enunciado').textContent = q.enunciado;

        opcoes.innerHTML = '<legend class="visually-hidden">Alternativas</legend>' + q.alternativas.map(function (a) {
            return '<label class="opcao" data-letra="' + a.letra + '">'
                + '<input type="radio" name="resposta" value="' + a.letra + '">'
                + '<span class="letra">' + a.letra + '</span>'
                + '<span>' + ui.escapar(a.texto) + '</span></label>';
        }).join('');

        mostrarMarcacao(q.marcada);
    }

    /** Carrega a próxima questão, sem repetir a atual, respeitando a disciplina escolhida. */
    async function proxima(excetoId) {
        if (ocupado) return;
        ocupado = true;
        try {
            mostrar(await api.sortear(filtro.value, excetoId));
        } catch (e) {
            if (e.status === 404) mostrar(null);
            else ui.aviso(e.message);
        } finally {
            ocupado = false;
        }
    }

    async function carregarDisciplinas() {
        const cat = await api.catalogo();
        cat.disciplinas.forEach(function (d) {
            const op = document.createElement('option');
            op.value = d;
            op.textContent = d;
            filtro.appendChild(op);
        });
    }

    opcoes.addEventListener('change', function () {
        botaoResponder.disabled = respondida;
    });

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!atual || respondida || ocupado) return;
        const escolhida = form.querySelector('input[name="resposta"]:checked');
        if (!escolhida) {
            resultado.className = 'alert alert-error mt';
            resultado.textContent = 'Escolha uma alternativa antes de responder.';
            resultado.hidden = false;
            return;
        }
        ocupado = true;
        try {
            const r = await api.responder(atual.id, escolhida.value);
            respondida = true;
            sessao.respondidas++;
            if (r.correct) sessao.acertos++;
            atualizarSessao();

            opcoes.disabled = true;
            botaoResponder.disabled = true;
            opcoes.querySelectorAll('.opcao').forEach(function (op) {
                if (op.dataset.letra === r.correctLetter) op.classList.add('certa');
                else if (op.dataset.letra === escolhida.value) op.classList.add('errada');
            });

            resultado.className = 'alert mt ' + (r.correct ? 'alert-ok' : 'alert-error');
            resultado.textContent = atual.anulada
                ? 'Questão anulada: a resposta conta como acerto.'
                : r.correct ? 'Você acertou!' : 'Resposta errada. A correta é a ' + r.correctLetter + '.';
            resultado.hidden = false;
            document.getElementById('proxima').focus();
        } catch (err) {
            ui.aviso(err.message);
        } finally {
            ocupado = false;
        }
    });

    document.getElementById('proxima').addEventListener('click', function () {
        proxima(atual ? atual.id : null);
    });
    filtro.addEventListener('change', function () { atual = null; proxima(null); });

    botaoMarcar.addEventListener('click', async function () {
        if (!atual) return;
        const marcar = botaoMarcar.getAttribute('aria-pressed') !== 'true';
        try {
            await api.marcar(atual.id, marcar);
            mostrarMarcacao(marcar);
            ui.aviso(marcar ? 'Marcada para revisão.' : 'Marcação removida.');
        } catch (err) {
            ui.aviso(err.message);
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (/input|textarea|select/i.test(e.target.tagName) && e.target.type !== 'radio') return;
        const tecla = e.key.toUpperCase();
        if (tecla === 'N') { proxima(atual ? atual.id : null); return; }
        if (respondida || !atual) return;
        const radio = form.querySelector('input[name="resposta"][value="' + tecla + '"]');
        if (radio) {
            radio.checked = true;
            radio.focus();
            botaoResponder.disabled = false;
        }
    });

    atualizarSessao();
    try {
        await carregarDisciplinas();
        const pedido = Number(new URLSearchParams(location.search).get('id'));
        if (pedido) {
            mostrar(await api.questaoParaResolver(pedido));
        } else {
            await proxima(null);
        }
    } catch (e) {
        ui.aviso(e.message);
    }
});
