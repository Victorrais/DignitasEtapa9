/* Importar PDF: valida o arquivo, envia para a API extrair as questões, revisa (incluindo o gabarito
   quando o PDF não traz) e confirma a gravação. A extração (PDFBox + OCR) roda no servidor. */
document.addEventListener('DOMContentLoaded', function () {
    const { api, regras, ui } = Dignitas;
    const TAMANHO_MAXIMO = 25 * 1024 * 1024; // igual ao limite configurado no servidor
    const form = document.getElementById('form-arquivo');
    const entrada = document.getElementById('arquivo');
    const zona = document.getElementById('zona');
    const caixaErros = document.getElementById('erros-arquivo');
    let arquivo = null;
    let previa = null;   // resposta de POST /api/importacoes
    let incluidas = {};  // índice -> boolean, escolhido na revisão
    let gabaritos = {};  // índice -> letra escolhida na revisão

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

    // ---------- Regras da revisão ----------

    /** Letra correta da questão: a escolhida na revisão, ou a que veio do PDF. */
    function letraCorreta(q) {
        if (gabaritos[q.indice]) return gabaritos[q.indice];
        const c = q.alternativas.find(function (a) { return a.correta; });
        return c ? c.letra : null;
    }

    /** Erros que impedem a gravação, exceto a falta de gabarito (que a revisão resolve). */
    function errosQueImpedem(q) {
        return q.erros.filter(function (e) { return e.indexOf('Marque exatamente') !== 0; });
    }

    function podeIncluir(q) {
        return !q.duplicada && errosQueImpedem(q).length === 0 && letraCorreta(q) !== null;
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
        const semGabarito = questoes.filter(function (q) { return !q.duplicada && letraCorreta(q) === null; }).length;
        let resumo = plural(questoes.length, 'questão encontrada', 'questões encontradas') + '.';
        if (repetidas) resumo += ' ' + plural(repetidas, 'já existe no banco e foi desmarcada.', 'já existem no banco e foram desmarcadas.');
        if (semGabarito) resumo += ' Escolha a alternativa correta de ' + plural(semGabarito, 'questão', 'questões') + ' para incluí-la.';
        document.getElementById('resumo-revisao').textContent = resumo;

        const avisos = previa.avisos.length
            ? '<div class="alert alert-info">' + previa.avisos.map(function (a) { return ui.escapar(a); }).join('<br>') + '</div>'
            : '';
        document.getElementById('lista-revisao').innerHTML = avisos + questoes.map(function (q) {
            const n = q.numero || q.indice + 1;
            const pode = podeIncluir(q);
            const marcas = [];
            if (q.duplicada) marcas.push('<span class="badge badge-warn">Já existe</span>');
            if (q.confianca < 0.8) marcas.push('<span class="badge badge-warn">Confira o texto</span>');
            errosQueImpedem(q).forEach(function (e) { marcas.push('<span class="badge badge-error">' + ui.escapar(e) + '</span>'); });
            if (!q.duplicada && letraCorreta(q) === null) marcas.push('<span class="badge badge-warn">Sem gabarito</span>');

            const alternativas = q.duplicada ? '' : '<fieldset class="gabarito"><legend>Alternativa correta</legend>'
                + q.alternativas.map(function (a) {
                    return '<label class="check"><input type="radio" name="gab-' + q.indice + '" value="' + a.letra + '"'
                        + (letraCorreta(q) === a.letra ? ' checked' : '') + '> ' + a.letra + '</label>';
                }).join('')
                + '</fieldset>';

            return '<div class="revisao-item">'
                + '<input type="checkbox" data-i="' + q.indice + '" aria-label="Incluir questão ' + n + '"'
                + (incluidas[q.indice] && pode ? ' checked' : '') + (pode ? '' : ' disabled') + '>'
                + '<div><strong>Questão ' + n + '</strong> · ' + ui.escapar(q.disciplina || 'Sem disciplina') + '<br>'
                + '<span class="muted">' + ui.escapar(q.enunciado) + '</span>' + alternativas + '</div>'
                + '<div class="acoes">' + marcas.join('') + '</div></div>';
        }).join('');

        document.getElementById('todas').checked = questoes.every(function (q) {
            return !podeIncluir(q) || incluidas[q.indice];
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
            gabaritos = {};
            incluidas = {};
            previa.questoes.forEach(function (q) { incluidas[q.indice] = podeIncluir(q); });
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
        const t = e.target;
        if (t.type === 'radio') {
            const indice = Number(t.name.replace('gab-', ''));
            gabaritos[indice] = t.value;
            incluidas[indice] = true; // escolher o gabarito já inclui a questão
            desenharRevisao();
        } else if (t.dataset.i != null) {
            incluidas[t.dataset.i] = t.checked;
        }
    });

    document.getElementById('todas').addEventListener('change', function (e) {
        previa.questoes.forEach(function (q) {
            if (podeIncluir(q)) incluidas[q.indice] = e.target.checked;
        });
        desenharRevisao();
    });

    document.getElementById('voltar').addEventListener('click', function () { passo(1); });

    document.getElementById('confirmar').addEventListener('click', async function () {
        const indices = previa.questoes
            .filter(function (q) { return incluidas[q.indice] && podeIncluir(q); })
            .map(function (q) { return q.indice; });
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
                indices: indices,
                gabaritos: gabaritos
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
                corpoTabela.innerHTML = '<tr><td colspan="5" class="empty">Nenhuma importação ainda.</td></tr>';
                return;
            }
            corpoTabela.innerHTML = lista.map(function (i) {
                return '<tr><td>' + ui.escapar(i.fileName) + '</td>'
                    + '<td>' + ui.escapar(regras.rotuloConcurso(i.board, i.year, i.examName)) + '</td>'
                    + '<td>' + ui.dataHora(i.importedAt) + '</td>'
                    + '<td class="num">' + i.questions + '</td>'
                    + '<td><button class="btn btn-small btn-danger" type="button" data-excluir="' + i.id + '">Excluir</button></td></tr>';
            }).join('');
        } catch (e) {
            ui.aviso(e.message);
        }
    }

    document.getElementById('t-importacoes').addEventListener('click', async function (e) {
        const botao = e.target.closest('[data-excluir]');
        if (!botao) return;
        const linha = botao.closest('tr').querySelector('td').textContent;
        if (!confirm('Excluir a importação "' + linha + '" e todas as questões dela? Esta ação não pode ser desfeita.')) return;
        try {
            await api.excluirImportacao(botao.dataset.excluir);
            ui.aviso('Importação excluída.');
            desenharImportacoes();
        } catch (err) {
            ui.aviso(err.message);
        }
    });

    async function carregarBancas() {
        const cat = await api.catalogo();
        document.getElementById('lista-bancas').innerHTML = cat.bancas.map(function (b) {
            return '<option value="' + ui.escapar(b) + '">';
        }).join('');
    }

    carregarBancas().catch(function (e) { ui.aviso(e.message); });
    desenharImportacoes();
});
