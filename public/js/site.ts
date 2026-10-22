(() => {
    function configurePasswordToggles(): void {
        document.querySelectorAll<HTMLButtonElement>(".password-toggle").forEach((button) => {
            button.addEventListener("click", () => {
                const input = document.getElementById(
                    button.dataset.passwordTarget || ""
                ) as HTMLInputElement | null;
                if (!input) return;

                const showPassword = input.type === "password";
                input.type = showPassword ? "text" : "password";
                button.textContent = showPassword ? "Hide" : "Show";
                button.setAttribute("aria-label", showPassword ? "Hide password" : "Show password");
            });
        });
    }

    function configureMobileMenu(): void {
        document.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof Node)) return;

            document
                .querySelectorAll<HTMLDetailsElement>("details.mobile-menu[open]")
                .forEach((menu) => {
                    if (!menu.contains(target)) menu.removeAttribute("open");
                });
        });
    }

    async function copyShortUrl(): Promise<void> {
        const urlElement = document.getElementById("shortUrl");
        const button = document.getElementById("copyShortUrlButton");
        if (!urlElement || !(button instanceof HTMLButtonElement)) return;

        try {
            await navigator.clipboard.writeText(urlElement.textContent?.trim() || "");
            button.textContent = "Copied";
        } catch {
            button.textContent = "Copy failed";
        }

        window.setTimeout(() => {
            button.textContent = "Copy link";
        }, 1800);
    }

    function isHttpUrl(value: string): boolean {
        try {
            const parsed = new URL(value);
            return parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch {
            return false;
        }
    }

    function currentLocalDateTime(): { date: string; time: string } {
        const now = new Date();
        const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
        return {
            date: local.toISOString().slice(0, 10),
            time: local.toISOString().slice(11, 16)
        };
    }

    function syncTimeLimit(
        dateInput: HTMLInputElement | null,
        timeInput: HTMLInputElement | null
    ): void {
        if (!dateInput || !timeInput) return;

        const now = currentLocalDateTime();
        if ((dateInput.value || now.date) === now.date) {
            timeInput.min = now.time;
        } else {
            timeInput.removeAttribute("min");
        }
    }

    function syncExpirationInstant(
        dateInput: HTMLInputElement | null,
        timeInput: HTMLInputElement | null,
        instantInput: HTMLInputElement | null
    ): void {
        if (!instantInput) return;
        if (!dateInput?.value || !timeInput?.value) {
            instantInput.value = "";
            return;
        }

        const instant = new Date(`${dateInput.value}T${timeInput.value}`);
        instantInput.value = Number.isNaN(instant.getTime()) ? "" : instant.toISOString();
    }

    function configureShortener(): void {
        document.getElementById("copyShortUrlButton")?.addEventListener("click", () => {
            void copyShortUrl();
        });

        const shortUrlForm = document.getElementById("shortUrlForm");
        const urlInput = document.getElementById("urlInput") as HTMLInputElement | null;
        const expirationDate = document.getElementById("expiresOnInput") as HTMLInputElement | null;
        const expirationTime = document.getElementById(
            "expiresAtTimeInput"
        ) as HTMLInputElement | null;
        const expirationInstant = document.getElementById(
            "expiresAtInput"
        ) as HTMLInputElement | null;

        if (urlInput instanceof HTMLInputElement) {
            urlInput.addEventListener("input", () => urlInput.setCustomValidity(""));
        }

        if (shortUrlForm instanceof HTMLFormElement) {
            shortUrlForm.addEventListener("submit", (event) => {
                if (!(urlInput instanceof HTMLInputElement) || !isHttpUrl(urlInput.value)) {
                    urlInput?.setCustomValidity(
                        "Enter a full URL starting with http:// or https://"
                    );
                    urlInput?.reportValidity();
                    event.preventDefault();
                    return;
                }
                urlInput.setCustomValidity("");
                syncExpirationInstant(expirationDate, expirationTime, expirationInstant);
            });
        }

        if (expirationDate && expirationTime) {
            syncTimeLimit(expirationDate, expirationTime);
            expirationDate.addEventListener("input", () =>
                syncTimeLimit(expirationDate, expirationTime)
            );
            expirationTime.addEventListener("focus", () =>
                syncTimeLimit(expirationDate, expirationTime)
            );
        }

        document.querySelectorAll<HTMLFormElement>(".inline-delete-form").forEach((form) => {
            form.addEventListener("submit", (event) => {
                if (!window.confirm("Delete this short link? This cannot be undone.")) {
                    event.preventDefault();
                }
            });
        });

        document.querySelectorAll<HTMLButtonElement>(".edit-close").forEach((button) => {
            button.addEventListener("click", () => {
                button.closest("details")?.removeAttribute("open");
            });
        });

        document.querySelectorAll<HTMLFormElement>(".manage-url-form").forEach((form) => {
            const dateInput = form.querySelector<HTMLInputElement>('input[name="expiresOn"]');
            const timeInput = form.querySelector<HTMLInputElement>('input[name="expiresAtTime"]');
            const instantInput = form.querySelector<HTMLInputElement>('input[name="expiresAt"]');
            syncTimeLimit(dateInput, timeInput);

            if (!dateInput || !timeInput) return;
            dateInput.addEventListener("input", () => syncTimeLimit(dateInput, timeInput));
            timeInput.addEventListener("focus", () => syncTimeLimit(dateInput, timeInput));
            form.addEventListener("submit", () => {
                syncExpirationInstant(dateInput, timeInput, instantInput);
            });
        });
    }

    configurePasswordToggles();
    configureMobileMenu();
    configureShortener();
})();
