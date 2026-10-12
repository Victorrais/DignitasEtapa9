/* Regras de negócio no navegador. Espelham as do back-end Java, para que a validação
   feita na página seja a mesma aplicada pelo servidor:
   - validarQuestao  ↔ QuestionDraft.validate()
   - normalizar      ↔ Texts.normalize()
   - rotuloConcurso  ↔ ExamLabels.of()
   - precisao        ↔ Dtos.Overview.accuracy()
   - paginas         ↔ Dtos.PageResult.pages() */
window.Dignitas = window.Dignitas || {};

Dignitas.regras = (function () {

    function vazio(s) {
        return s == null || String(s).trim() === '';
    }

    /** Minúsculas, sem acentos, sem pontuação nem espaços: usado para detectar duplicidade. */
    function normalizar(s) {
        if (s == null) return '';
        return String(s).normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    }

    /** Retorna a lista de erros da questão; lista vazia significa questão válida. */
    function validarQuestao(q) {
        const erros = [];
        if (vazio(q.enunciado) && vazio(q.textoBase)) erros.push('O enunciado está vazio.');
        const alternativas = q.alternativas || [];
        if (alternativas.length < 2) erros.push('A questão precisa de pelo menos 2 alternativas.');
        alternativas.forEach(function (a) {
            if (vazio(a.texto)) erros.push('A alternativa ' + a.letra + ' está vazia.');
        });
        const corretas = alternativas.filter(function (a) { return a.correta; }).length;
        if (!q.anulada && corretas !== 1) {
            erros.push('Marque exatamente uma alternativa correta (ou marque a questão como anulada).');
        }
        return erros;
    }

    /** Chave de conteúdo: enunciado e alternativas normalizados. Iguais = questão repetida. */
    function chaveConteudo(q) {
        return [normalizar(q.enunciado)].concat((q.alternativas || []).map(function (a) {
            return normalizar(a.texto);
        })).join('|');
    }

    function rotuloConcurso(banca, ano, nome) {
        const partes = [];
        if (!vazio(banca)) partes.push(String(banca).trim());
        if (ano != null && ano !== '') partes.push(String(ano));
        if (!vazio(nome)) partes.push(String(nome).trim());
        return partes.length ? partes.join(' · ') : '—';
    }

    function precisao(acertos, total) {
        return total === 0 ? 0 : acertos / total;
    }

    function paginas(total, tamanho) {
        return Math.max(1, Math.ceil(total / tamanho));
    }

    /** Ano de prova aceitável: quatro dígitos entre 1950 e o ano seguinte ao atual. */
    function anoValido(ano) {
        if (vazio(ano)) return true;
        const n = Number(ano);
        return Number.isInteger(n) && n >= 1950 && n <= new Date().getFullYear() + 1;
    }

    return { vazio, normalizar, validarQuestao, chaveConteudo, rotuloConcurso, precisao, paginas, anoValido };
})();
