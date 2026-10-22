/* global document, window, MutationObserver */

(() => {
    const copyText = async (value: string): Promise<void> => {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(value);
            return;
        }

        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
    };

    const addPageShell = () => {
        if (document.querySelector(".api-docs-header")) return;

        const swagger = document.querySelector(".swagger-ui");
        if (!swagger) return;

        const skipLink = document.createElement("a");
        skipLink.className = "api-skip-link";
        skipLink.href = "#api-reference";
        skipLink.textContent = "Skip to API reference";

        const header = document.createElement("header");
        header.className = "api-docs-header";
        header.innerHTML = `
            <nav class="api-docs-nav" aria-label="API documentation navigation">
                <a class="api-docs-brand" href="/ui">
                    <img src="/images/url-shortener-logo.png" width="36" height="18" alt="">
                    <span>URL Shortener</span>
                    <span class="api-docs-badge">API Docs</span>
                </a>
                <a class="api-docs-back" href="/ui">Back to app</a>
            </nav>`;

        swagger.id = "api-reference";
        swagger.setAttribute("role", "main");
        swagger.before(header);
        header.before(skipLink);
    };

    const addCopyButtons = () => {
        const selectors = [
            ".swagger-ui .curl-command",
            ".swagger-ui .highlight-code > pre",
            ".swagger-ui pre.microlight"
        ];

        document.querySelectorAll(selectors.join(",")).forEach((codeBlock) => {
            if (codeBlock.matches("pre") && codeBlock.closest(".curl-command")) return;
            if (codeBlock.querySelector(":scope > .api-copy-button")) return;

            const value = codeBlock.textContent.trim();
            if (!value) return;

            codeBlock.classList.add("api-copy-surface");

            const button = document.createElement("button");
            button.type = "button";
            button.className = "api-copy-button";
            button.textContent = "Copy";
            button.setAttribute("aria-label", "Copy code to clipboard");
            button.setAttribute("aria-live", "polite");

            button.addEventListener("click", async () => {
                try {
                    await copyText(value);
                    button.textContent = "Copied";
                    button.setAttribute("aria-label", "Code copied to clipboard");
                } catch {
                    button.textContent = "Try again";
                    button.setAttribute("aria-label", "Copy failed. Try again");
                }

                window.setTimeout(() => {
                    button.textContent = "Copy";
                    button.setAttribute("aria-label", "Copy code to clipboard");
                }, 1800);
            });

            codeBlock.appendChild(button);
        });
    };

    const improveGeneratedControls = () => {
        const filter = document.querySelector(".swagger-ui .operation-filter-input");
        if (filter) {
            filter.setAttribute("aria-label", "Filter API endpoints");
            filter.setAttribute("autocomplete", "off");
            filter.setAttribute("spellcheck", "false");
            filter.setAttribute("placeholder", "Filter endpoints…");
        }
    };

    const enhance = () => {
        addPageShell();
        addCopyButtons();
        improveGeneratedControls();
    };

    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    enhance();
})();
