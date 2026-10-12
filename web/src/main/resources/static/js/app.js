/* Comportamento comum a todas as páginas: menu em telas pequenas, tema claro/escuro
   e pequenos utilitários de interface. */
window.Dignitas = window.Dignitas || {};

Dignitas.ui = (function () {

    function escapar(texto) {
        return String(texto == null ? '' : texto)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function percentual(valor) {
        return Math.round(valor * 100) + '%';
    }

    function data(iso) {
        const d = new Date(iso);
        return isNaN(d) ? iso : d.toLocaleDateString('pt-BR');
    }

    function dataHora(iso) {
        const d = new Date(iso);
        return isNaN(d) ? iso : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    }

    let toastTimer;
    function aviso(mensagem) {
        let el = document.getElementById('toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'toast';
            el.className = 'toast';
            el.setAttribute('role', 'status');
            document.body.appendChild(el);
        }
        el.textContent = mensagem;
        el.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2800);
    }

    function iniciarMenu() {
        const botao = document.getElementById('menu-toggle');
        const menu = document.getElementById('sidebar');
        if (!botao || !menu) return;
        let fundo = null;

        function fechar() {
            menu.classList.remove('open');
            botao.setAttribute('aria-expanded', 'false');
            if (fundo) { fundo.remove(); fundo = null; }
        }

        botao.addEventListener('click', function () {
            if (menu.classList.contains('open')) { fechar(); return; }
            menu.classList.add('open');
            botao.setAttribute('aria-expanded', 'true');
            fundo = document.createElement('div');
            fundo.className = 'backdrop';
            fundo.addEventListener('click', fechar);
            document.body.appendChild(fundo);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') fechar();
        });
    }

    function iniciarTema() {
        const raiz = document.documentElement;
        try {
            const salvo = localStorage.getItem('dignitas.tema');
            if (salvo === 'dark' || salvo === 'light') raiz.dataset.theme = salvo;
        } catch (e) { /* sem armazenamento: segue o sistema */ }

        const botao = document.getElementById('theme-toggle');
        if (!botao) return;
        botao.addEventListener('click', function () {
            const escuroAgora = raiz.dataset.theme
                ? raiz.dataset.theme === 'dark'
                : window.matchMedia('(prefers-color-scheme: dark)').matches;
            raiz.dataset.theme = escuroAgora ? 'light' : 'dark';
            try { localStorage.setItem('dignitas.tema', raiz.dataset.theme); } catch (e) { /* ignora */ }
        });
    }

    function marcarPaginaAtual() {
        const pagina = document.body.dataset.page;
        document.querySelectorAll('.nav a').forEach(function (a) {
            if (a.dataset.page === pagina) a.setAttribute('aria-current', 'page');
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        iniciarMenu();
        iniciarTema();
        marcarPaginaAtual();
    });

    return { escapar, percentual, data, dataHora, aviso };
})();
