/* Importar PDF: valida o arquivo, envia para a API extrair as questões, revisa e confirma a gravação.
   A extração (PDFBox + OCR) roda no servidor; a prévia só é gravada quando o usuário confirma. */
document.addEventListener('DOMContentLoaded', function () {
    const { api, regras, ui } = Dignitas;
    const TAMANHO_MAXIMO = 25 * 1024 * 1024; // igual ao limite configurado no servidor
    const form = document.getElementById('form-arquivo');
    const entrada = document.getElementById('arquivo');
    const zona = document.getElementById('zona');
    const caixaErros = document.getElementById('erros-arquivo');
    let arquivo = null;
    let previa = null;     // resposta de POST /api/importacoes
    let incluidas = {};    // índice -> boolean, escolhido na revisão

    function plural(n, singular, varios) {
        return n + ' ' + (n === 1 ? singular : varios);
    }

    // ---------- Escolha do arquivo (clique ou arrastar) ----------

    function escolher(f) {
        arquivo = f || null;
        const rotulo = document.getElementById('nome-arquivo');
        rotulo.hidden = !arquivo;
        rotulo.textContent = arquivo ? arquivo.name + ' · ' + (arquivo.size / 1024 / 1024).toFixed(1) + ' MB' : '';
    }

    entrada.addEventListener('change', function () { escolher(entrada.files[0]); });
    ['dragenter', 'dragover'].forEach(function (ev) {
        zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.add('arrastando'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
        zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.remove('arrastando'); });
    });
    zona.addEventListener('drop', function (e) { escolher(e.dataTransfer.files[0]); });

    // ---------- Validação do formulário ----------

    function marcar(id, mensagem) {
        const campo = document.getElementById(id);
        campo.closest('.field').classList.toggle('invalid', !!mensagem);
        campo.setAttribute('aria-invalid', String(!!mensagem));
        document.getElementById('erro-' + id).textContent = mensagem || '';
    }

    function validar() {
        const erros = [];
        if (!arquivo) {
            erros.push('Escolha um arquivo PDF.');
        } else {
            if (!/\.pdf$/i.test(arquivo.name)) erros.push('O arquivo precisa ser um PDF.');
            if (arquivo.size === 0) erros.push('O arquivo está vazio.');
            if (arquivo.size > TAMANHO_MAXIMO) erros.push('O arquivo passa de 25 MB.');
        }
        const concurso = document.getElementById('i-concurso').value.trim();
        marcar('i-concurso', concurso ? '' : 'Informe o concurso.');
        if (!concurso) erros.push('Informe o nome do concurso.');

        const anoOk = regras.anoValido(document.getElementById('i-ano').value);
        marcar('i-ano', anoOk ? '' : 'Ano inválido.');
        if (!anoOk) erros.push('O ano deve estar entre 1950 e ' + (new Date().getFullYear() + 1) + '.');

        caixaErros.hidden = erros.length === 0;
        caixaErros.innerHTML = erros.length
            ? '<strong>Não foi possível continuar:</strong><ul>' + erros.map(function (e) { return '<li>' + ui.escapar(e) + '</li>'; }).join('') + '</ul>'
            : '';
        return erros.length === 0;
    }

    // ---------- Etapas ----------

    function passo(n) {
        [1, 2, 3].forEach(function (i) {
            const li = document.getElementById('passo-' + i);
            li.className = i < n ? 'feito' : i === n ? 'ativo' : '';
            if (i === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
        });
        form.hidden = n !== 1;
        document.getElementById('revisao').hidden = n !== 2;
        document.getElementById('concluido').hidden = n !== 3;
    }

    function desenharRevisao() {
        const questoes = previa.questoes;
        const repetidas = questoes.filter(function (q) { return q.duplicada; }).length;
        document.getElementById('resumo-revisao').textContent = plural(questoes.length, 'questão encontrada', 'questões encontradas')
            + (repetidas === 0 ? '.'
                : '; ' + (repetidas === 1 ? '1 já existe no banco e foi desmarcada.' : repetidas + ' já existem no banco e foram desmarcadas.'));

        const avisos = previa.avisos.length
            ? '<div class="alert alert-info">' + previa.avisos.map(function (a) { return ui.escapar(a); }).join('<br>') + '</div>'
            : '';
        document.getElementById('lista-revisao').innerHTML = avisos + questoes.map(function (q) {
            const marcas = [];
            if (q.duplicada) marcas.push('<span class="badge badge-warn">Já existe</span>');
            if (q.confianca < 0.8) marcas.push('<span class="badge badge-warn">Confira o texto</span>');
            if (q.erros.length) marcas.push('<span class="badge badge-error">' + ui.escapar(q.erros[0]) + '</span>');
            return '<div class="revisao-item">'
                + '<input type="checkbox" data-i="' + q.indice + '" aria-label="Incluir questão ' + (q.numero || q.indice + 1) + '"'
                + (incluidas[q.indice] ? ' checked' : '') + (q.duplicada || q.erros.length ? ' disabled' : '') + '>'
                + '<div><strong>Questão ' + (q.numero || q.indice + 1) + '</strong> · ' + ui.escapar(q.disciplina || 'Sem disciplina') + '<br>'
                + '<span class="muted">' + ui.escapar(q.enunciado) + '</span></div>'
                + '<div class="acoes">' + marcas.join('') + '</div></div>';
        }).join('');
        document.getElementById('todas').checked = questoes.every(function (q) {
            return q.duplicada || q.erros.length || incluidas[q.indice];
        });
    }

    // ---------- Envio ----------

    function mostrarProgresso(texto, pct) {
        document.getElementById('progresso').hidden = false;
        document.getElementById('progresso-texto').textContent = texto;
        document.getElementById('progresso-pct').textContent = pct + '%';
        document.getElementById('progresso-barra').style.width = pct + '%';
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!validar()) { caixaErros.scrollIntoView({ block: 'nearest' }); return; }

        const botao = document.getElementById('enviar');
        const usarOcr = document.getElementById('i-ocr').checked;
        const corpo = new FormData();
        corpo.append('arquivo', arquivo);
        corpo.append('ocr', usarOcr ? 'AUTO' : 'TEXT_ONLY');

        botao.disabled = true;
        mostrarProgresso(usarOcr ? 'Lendo páginas e reconhecendo texto (OCR)… isso pode levar alguns minutos.'
            : 'Lendo as páginas do PDF…', 50);
        try {
            previa = await api.previaImportacao(corpo);
            incluidas = {};
            previa.questoes.forEach(function (q) { incluidas[q.indice] = !q.duplicada && q.erros.length === 0; });
            mostrarProgresso('Pronto', 100);
            desenharRevisao();
            passo(2);
        } catch (err) {
            mostrarProgresso('Não foi possível extrair as questões.', 0);
            caixaErros.hidden = false;
            caixaErros.innerHTML = '<strong>' + ui.escapar(err.message) + '</strong>'
                + (err.detalhes && err.detalhes.length ? '<ul>' + err.detalhes.map(function (d) { return '<li>' + ui.escapar(d) + '</li>'; }).join('') + '</ul>' : '');
        } finally {
            botao.disabled = false;
        }
    });

    // ---------- Revisão ----------

    document.getElementById('lista-revisao').addEventListener('change', function (e) {
        const i = e.target.dataset.i;
        if (i != null) incluidas[i] = e.target.checked;
    });

    document.getElementById('todas').addEventListener('change', function (e) {
        previa.questoes.forEach(function (q) {
            if (!q.duplicada && q.erros.length === 0) incluidas[q.indice] = e.target.checked;
        });
        desenharRevisao();
    });

    document.getElementById('voltar').addEventListener('click', function () { passo(1); });

    document.getElementById('confirmar').addEventListener('click', async function () {
        const indices = Object.keys(incluidas).filter(function (k) { return incluidas[k]; }).map(Number);
        if (indices.length === 0) {
            ui.aviso('Selecione ao menos uma questão válida.');
            return;
        }
        const botao = document.getElementById('confirmar');
        botao.disabled = true;
        try {
            const r = await api.confirmarImportacao(previa.id, {
                concurso: document.getElementById('i-concurso').value.trim(),
                banca: document.getElementById('i-banca').value.trim() || null,
                ano: document.getElementById('i-ano').value ? Number(document.getElementById('i-ano').value) : null,
                indices: indices
            });
            document.getElementById('resumo-final').textContent = plural(r.salvas, 'questão salva', 'questões salvas')
                + (r.ignoradas ? ', ' + plural(r.ignoradas, 'ignorada (repetida ou inválida).', 'ignoradas (repetidas ou inválidas).') : '.');
            passo(3);
            desenharImportacoes();
        } catch (err) {
            ui.aviso(err.message);
        } finally {
            botao.disabled = false;
        }
    });

    document.getElementById('nova').addEventListener('click', function () {
        form.reset();
        escolher(null);
        previa = null;
        document.getElementById('progresso').hidden = true;
        caixaErros.hidden = true;
        passo(1);
    });

    // ---------- Histórico de importações ----------

    async function desenharImportacoes() {
        const corpoTabela = document.getElementById('t-importacoes');
        try {
            const lista = await api.importacoes();
            if (lista.length === 0) {
                corpoTabela.innerHTML = '<tr><td colspan="4" class="empty">Nenhuma importação ainda.</td></tr>';
                return;
            }
            corpoTabela.innerHTML = lista.map(function (i) {
                return '<tr><td>' + ui.escapar(i.fileName) + '</td>'
                    + '<td>' + ui.escapar(regras.rotuloConcurso(i.board, i.year, i.examName)) + '</td>'
                    + '<td>' + ui.dataHora(i.importedAt) + '</td>'
                    + '<td class="num">' + i.questions + '</td></tr>';
            }).join('');
        } catch (e) {
            ui.aviso(e.message);
        }
    }

    async function carregarBancas() {
        const cat = await api.catalogo();
        document.getElementById('lista-bancas').innerHTML = cat.bancas.map(function (b) {
            return '<option value="' + ui.escapar(b) + '">';
        }).join('');
    }

    carregarBancas().catch(function (e) { ui.aviso(e.message); });
    desenharImportacoes();
});
