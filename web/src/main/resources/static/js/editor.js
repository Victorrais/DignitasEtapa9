/* Editor de questão: alternativas dinâmicas, validação no cliente e gravação pela API.
   A validação de cliente usa as mesmas regras do servidor; o servidor confere de novo ao salvar. */
document.addEventListener('DOMContentLoaded', async function () {
    const { api, regras, ui } = Dignitas;
    const LETRAS = ['A', 'B', 'C', 'D', 'E'];
    const MIN = 2;
    const form = document.getElementById('form-questao');
    const lista = document.getElementById('alternativas');
    const botaoAdicionar = document.getElementById('adicionar');
    const resumo = document.getElementById('resumo-erros');
    const enunciado = document.getElementById('enunciado');
    const contador = document.getElementById('contador-enunciado');

    function preencherLista(id, valores) {
        document.getElementById(id).innerHTML = valores.map(function (v) {
            return '<option value="' + ui.escapar(v) + '">';
        }).join('');
    }

    function tipo() {
        return form.querySelector('input[name="tipo"]:checked').value;
    }

    // ---------- Alternativas ----------

    function criarAlternativa(letra, texto, somenteLeitura) {
        const linha = document.createElement('div');
        linha.className = 'alternativa';
        linha.innerHTML =
            '<input type="radio" name="correta" value="' + letra + '" aria-label="Alternativa ' + letra + ' é a correta">'
            + '<span class="letra" aria-hidden="true">' + letra + '</span>'
            + '<textarea rows="1" aria-label="Texto da alternativa ' + letra + '"'
            + (somenteLeitura ? ' readonly' : '') + '>' + ui.escapar(texto || '') + '</textarea>'
            + (somenteLeitura ? '<span></span>'
                : '<button class="btn btn-small btn-danger" type="button" data-remover aria-label="Remover alternativa ' + letra + '">✕</button>');
        return linha;
    }

    function reletrar() {
        lista.querySelectorAll('.alternativa').forEach(function (linha, i) {
            const letra = LETRAS[i];
            linha.querySelector('.letra').textContent = letra;
            linha.querySelector('input').value = letra;
            linha.querySelector('input').setAttribute('aria-label', 'Alternativa ' + letra + ' é a correta');
            linha.querySelector('textarea').setAttribute('aria-label', 'Texto da alternativa ' + letra);
        });
        atualizarControles();
    }

    function atualizarControles() {
        const qtd = lista.children.length;
        botaoAdicionar.hidden = tipo() !== 'multipla';
        botaoAdicionar.disabled = qtd >= LETRAS.length;
        lista.querySelectorAll('[data-remover]').forEach(function (b) { b.disabled = qtd <= MIN; });
        lista.querySelectorAll('.alternativa').forEach(function (linha) {
            linha.classList.toggle('correta', linha.querySelector('input').checked);
        });
    }

    function montarAlternativas() {
        lista.innerHTML = '';
        if (tipo() === 'certo-errado') {
            lista.appendChild(criarAlternativa('C', 'Certo', true));
            lista.appendChild(criarAlternativa('E', 'Errado', true));
        } else {
            LETRAS.forEach(function (l) { lista.appendChild(criarAlternativa(l, '', false)); });
        }
        atualizarControles();
    }

    botaoAdicionar.addEventListener('click', function () {
        if (lista.children.length >= LETRAS.length) return;
        const nova = criarAlternativa(LETRAS[lista.children.length], '', false);
        lista.appendChild(nova);
        nova.querySelector('textarea').focus();
        atualizarControles();
    });

    lista.addEventListener('click', function (e) {
        const remover = e.target.closest('[data-remover]');
        if (!remover || lista.children.length <= MIN) return;
        remover.closest('.alternativa').remove();
        reletrar();
    });

    lista.addEventListener('change', atualizarControles);
    form.querySelectorAll('input[name="tipo"]').forEach(function (r) {
        r.addEventListener('change', montarAlternativas);
    });

    // ---------- Contador de caracteres ----------

    function atualizarContador() {
        const usados = enunciado.value.length;
        const max = Number(enunciado.getAttribute('maxlength'));
        contador.textContent = usados + ' / ' + max;
        contador.classList.toggle('limite', usados >= max * 0.95);
    }
    enunciado.addEventListener('input', atualizarContador);

    // ---------- Validação ----------

    function lerQuestao() {
        const correta = form.querySelector('input[name="correta"]:checked');
        const numero = document.getElementById('numero').value;
        const ano = document.getElementById('ano').value;
        return {
            textoBase: document.getElementById('texto-base').value.trim(),
            enunciado: enunciado.value.trim(),
            disciplina: document.getElementById('disciplina').value.trim(),
            concurso: document.getElementById('concurso').value.trim(),
            banca: document.getElementById('banca').value.trim(),
            ano: ano ? Number(ano) : null,
            numero: numero ? Number(numero) : null,
            anulada: document.getElementById('anulada').checked,
            alternativas: Array.prototype.map.call(lista.querySelectorAll('.alternativa'), function (linha) {
                const letra = linha.querySelector('.letra').textContent;
                return { letra: letra, texto: linha.querySelector('textarea').value.trim(), correta: !!correta && correta.value === letra };
            })
        };
    }

    function marcarCampo(id, mensagem) {
        const campo = document.getElementById(id);
        const erro = document.getElementById('erro-' + id);
        campo.closest('.field').classList.toggle('invalid', !!mensagem);
        campo.setAttribute('aria-invalid', String(!!mensagem));
        if (erro) erro.textContent = mensagem || '';
    }

    function validar(q) {
        const erros = regras.validarQuestao(q);

        marcarCampo('enunciado', erros.indexOf('O enunciado está vazio.') >= 0 ? 'Informe o enunciado.' : '');

        const anoOk = regras.anoValido(document.getElementById('ano').value);
        if (!anoOk) erros.push('O ano deve estar entre 1950 e ' + (new Date().getFullYear() + 1) + '.');
        marcarCampo('ano', anoOk ? '' : 'Ano inválido.');

        const numeroOk = q.numero == null || (Number.isInteger(q.numero) && q.numero > 0);
        if (!numeroOk) erros.push('O número da questão deve ser um inteiro positivo.');
        marcarCampo('numero', numeroOk ? '' : 'Número inválido.');

        lista.querySelectorAll('.alternativa').forEach(function (linha) {
            linha.classList.toggle('invalid', linha.querySelector('textarea').value.trim() === '');
        });

        // Abaixo das alternativas, só um aviso curto; a lista completa fica no resumo do topo
        const avisos = [];
        if (erros.some(function (e) { return /^A alternativa .* está vazia\.$/.test(e); })) avisos.push('Preencha as alternativas destacadas.');
        if (erros.some(function (e) { return e.indexOf('pelo menos 2') >= 0; })) avisos.push('Use pelo menos 2 alternativas.');
        if (erros.some(function (e) { return e.indexOf('Marque') === 0; })) avisos.push('Marque a alternativa correta.');
        document.getElementById('erro-alternativas').textContent = avisos.join(' ');
        return erros;
    }

    function mostrarResumo(erros) {
        if (erros.length === 0) {
            resumo.hidden = true;
            return;
        }
        resumo.innerHTML = '<strong>Corrija ' + (erros.length === 1 ? 'o problema' : 'os ' + erros.length + ' problemas')
            + ' antes de salvar:</strong><ul>' + erros.map(function (e) { return '<li>' + ui.escapar(e) + '</li>'; }).join('') + '</ul>';
        resumo.hidden = false;
        resumo.focus();
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const q = lerQuestao();
        const erros = validar(q);
        mostrarResumo(erros);
        if (erros.length > 0) return;

        const botao = form.querySelector('button[type="submit"]');
        botao.disabled = true;
        try {
            const criada = await api.criarQuestao(q);
            ui.aviso('Questão ' + criada.id + ' salva.');
            form.reset();
            setTimeout(function () { montarAlternativas(); atualizarContador(); });
        } catch (err) {
            // Erros de regra vindos do servidor (ex.: questão repetida) aparecem no mesmo resumo
            mostrarResumo([err.message].concat(err.detalhes || []));
        } finally {
            botao.disabled = false;
        }
    });

    form.addEventListener('reset', function () {
        resumo.hidden = true;
        form.querySelectorAll('.field.invalid').forEach(function (f) { f.classList.remove('invalid'); });
        form.querySelectorAll('.field-error').forEach(function (s) { s.textContent = ''; });
        setTimeout(function () { montarAlternativas(); atualizarContador(); });
    });

    // Revalida ao sair de um campo que já mostrava erro
    form.addEventListener('focusout', function (e) {
        if (e.target.closest('.field.invalid, .alternativa.invalid')) validar(lerQuestao());
    });

    montarAlternativas();
    atualizarContador();
    try {
        const cat = await api.catalogo();
        preencherLista('lista-disciplinas', cat.disciplinas);
        preencherLista('lista-bancas', cat.bancas);
    } catch (e) {
        ui.aviso(e.message);
    }
});
