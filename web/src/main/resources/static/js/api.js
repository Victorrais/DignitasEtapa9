/* Cliente da API REST do Dignitas. Todas as chamadas devolvem Promises.
   Erros do servidor chegam como Error com .erro (mensagem), .detalhes (lista) e .status. */
window.Dignitas = window.Dignitas || {};

Dignitas.api = (function () {

    function query(params) {
        const q = new URLSearchParams();
        Object.keys(params || {}).forEach(function (k) {
            const v = params[k];
            if (v !== null && v !== undefined && v !== '') q.set(k, v);
        });
        const s = q.toString();
        return s ? '?' + s : '';
    }

    async function requisitar(metodo, url, corpo) {
        const opcoes = { method: metodo, headers: {} };
        if (corpo instanceof FormData) {
            opcoes.body = corpo; // o navegador define o Content-Type com o boundary
        } else if (corpo !== undefined) {
            opcoes.headers['Content-Type'] = 'application/json';
            opcoes.body = JSON.stringify(corpo);
        }
        let resposta;
        try {
            resposta = await fetch(url, opcoes);
        } catch (e) {
            throw erroDeRede();
        }
        if (resposta.status === 204) return null;
        const dados = await resposta.json().catch(function () { return {}; });
        if (!resposta.ok) {
            const err = new Error(dados.erro || 'Erro inesperado no servidor.');
            err.detalhes = dados.detalhes || [];
            err.status = resposta.status;
            throw err;
        }
        return dados;
    }

    function erroDeRede() {
        return new Error('Não foi possível conectar ao servidor. Verifique se a aplicação está em execução.');
    }

    return {
        // ---------- Questões ----------
        listarQuestoes: (f) => requisitar('GET', '/api/questoes' + query(f)),
        questao: (id) => requisitar('GET', '/api/questoes/' + id),
        questaoParaResolver: (id) => requisitar('GET', '/api/questoes/' + id + '/pratica'),
        sortear: (disciplina, excetoId) => requisitar('GET', '/api/questoes/sorteio' + query({ disciplina, excetoId })),
        criarQuestao: (q) => requisitar('POST', '/api/questoes', q),
        atualizarQuestao: (id, q) => requisitar('PUT', '/api/questoes/' + id, q),
        excluirQuestao: (id) => requisitar('DELETE', '/api/questoes/' + id),
        marcar: (id, marcada) => requisitar('PATCH', '/api/questoes/' + id + '/marcacao', { marcada: marcada }),

        // ---------- Respostas ----------
        responder: (questaoId, letra) => requisitar('POST', '/api/tentativas', { questaoId: questaoId, letra: letra }),
        historico: (f) => requisitar('GET', '/api/tentativas' + query(f)),
        limparHistorico: () => requisitar('DELETE', '/api/tentativas'),

        // ---------- Leituras ----------
        estatisticas: () => requisitar('GET', '/api/estatisticas'),
        catalogo: () => requisitar('GET', '/api/catalogo'),

        // ---------- Importação ----------
        previaImportacao: (formData) => requisitar('POST', '/api/importacoes', formData),
        confirmarImportacao: (id, corpo) => requisitar('POST', '/api/importacoes/' + encodeURIComponent(id) + '/confirmar', corpo),
        importacoes: () => requisitar('GET', '/api/importacoes'),
        excluirImportacao: (id) => requisitar('DELETE', '/api/importacoes/' + id)
    };
})();
