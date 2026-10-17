const lastUpdated = "17 October 2026";

const legalPages = {
    privacy: {
        title: "Privacy notice",
        summary: "How this service collects, uses, stores, and protects information.",
        lastUpdated,
        sections: [
            {
                heading: "Information collected",
                paragraphs: [
                    "When you create an account, the service collects the account information needed to register you and let you sign in.",
                    "When you create or manage a short link, the service stores the destination, any alias or expiration you choose, and information needed to associate the link with your account.",
                    "Basic usage and security information may be collected when the service is used, including link visits, an approximate region when available, and browser or device signals used to operate and protect the service."
                ]
            },
            {
                heading: "How information is used",
                paragraphs: [
                    "Information is used to create and redirect links, authenticate accounts, provide dashboards and aggregate analytics, prevent abuse, enforce service rules, diagnose failures, and protect the service. It is not sold or used for advertising."
                ]
            },
            {
                heading: "Cookies",
                paragraphs: [
                    "Essential cookies are used to keep you signed in and provide account features. The service does not use advertising cookies."
                ]
            },
            {
                heading: "Service providers",
                paragraphs: [
                    "Trusted service providers may process limited information when helping to host, secure, maintain, or support the service. They process information under their own terms and privacy notices and may operate in other countries."
                ]
            },
            {
                heading: "Retention",
                paragraphs: [
                    "Account information is generally kept while your account is active. Link and usage information is kept while needed to provide the service, resolve disputes, meet legal obligations, or protect users. Information may be deleted or anonymised when it is no longer required, and valid deletion requests are handled subject to applicable law."
                ]
            },
            {
                heading: "Security",
                paragraphs: [
                    "Reasonable technical and organisational safeguards are used to protect information from unauthorised access, loss, misuse, or alteration. No internet service can guarantee absolute security."
                ]
            },
            {
                heading: "Your rights and deletion requests",
                paragraphs: [
                    "Depending on applicable law, you may request access, correction, deletion, restriction, or a copy of your personal data, and may object to or withdraw consent for certain processing. To request deletion, use the contact links below and include your username and relevant short-link aliases. Identity verification may be required before account data is changed or deleted."
                ]
            },
            {
                heading: "Contact",
                paragraphs: [
                    "Udit Aswal operates this service. Use the Portfolio, GitHub, or LinkedIn contact links below for privacy questions and rights requests. Use Report abuse for unsafe or unlawful links."
                ]
            }
        ]
    },
    terms: {
        title: "Terms of service",
        summary: "The basic rules that apply when you use this URL-shortening service.",
        lastUpdated,
        sections: [
            {
                heading: "Using the service",
                paragraphs: [
                    "By using the service, you agree to these terms and the Acceptable Use Policy. You must be legally able to enter this agreement and provide accurate account information."
                ]
            },
            {
                heading: "Account responsibilities",
                paragraphs: [
                    "You are responsible for keeping your credentials secure and for activity performed through your account. Notify the operator promptly if you believe your account or links have been compromised."
                ]
            },
            {
                heading: "Availability and changes",
                paragraphs: [
                    "The service is provided on an as-available basis. Features may change, pause, or stop without notice, and uninterrupted redirects, storage, or analytics are not guaranteed. Keep your own records of important destinations."
                ]
            },
            {
                heading: "Link removal and suspension",
                paragraphs: [
                    "Links may be disabled or removed, and accounts may be suspended, when reasonably necessary to address abuse, security risk, legal requests, policy violations, service integrity, or prolonged inactivity. The operator may investigate reports and preserve relevant records where permitted by law."
                ]
            },
            {
                heading: "Your content",
                paragraphs: [
                    "You retain responsibility for URLs and other content you submit. You confirm that you have the right to submit them and that their use does not violate law, third-party rights, or the Acceptable Use Policy."
                ]
            },
            {
                heading: "Liability",
                paragraphs: [
                    "To the maximum extent permitted by law, the service is provided without warranties and the operator is not liable for indirect, incidental, special, consequential, or loss-of-data damages arising from use, interruption, third-party destinations, or misuse of shortened links. Nothing here excludes liability that cannot legally be excluded."
                ]
            },
            {
                heading: "Governing law",
                paragraphs: [
                    "These terms are governed by the laws of India. Courts with competent jurisdiction in India will handle disputes, subject to any mandatory rights available under applicable law."
                ]
            }
        ]
    },
    "acceptable-use": {
        title: "Acceptable use",
        summary: "Safety rules for accounts, destinations, and shortened links.",
        lastUpdated,
        sections: [
            {
                heading: "Prohibited activity",
                paragraphs: ["Do not use this service to create, distribute, promote, or conceal:"],
                items: [
                    "Phishing, credential theft, deceptive redirects, or fraudulent pages.",
                    "Malware, ransomware, harmful downloads, exploit kits, or malicious scripts.",
                    "Unsolicited bulk messages, spam campaigns, or abusive automated traffic.",
                    "Illegal material or activity, including content that exploits or endangers people.",
                    "Impersonation, misleading affiliation, or links intended to deceive users about their destination.",
                    "Attempts to bypass authentication, rate limits, moderation, security controls, or access restrictions."
                ]
            },
            {
                heading: "Enforcement",
                paragraphs: [
                    "Suspected violations may result in link removal, account suspension, traffic blocking, preservation of relevant evidence, or referral to appropriate authorities when legally required."
                ]
            },
            {
                heading: "Report a problem",
                paragraphs: [
                    "If a shortened link appears unsafe, deceptive, or unlawful, do not open it again. Copy the short URL and submit it through the Report abuse page."
                ]
            }
        ]
    },
    "report-abuse": {
        title: "Report abuse",
        summary: "Tell the operator about a shortened link that may be unsafe or unlawful.",
        lastUpdated,
        sections: [
            {
                heading: "What to include",
                paragraphs: [
                    "Include the complete shortened URL, why it appears harmful, and any useful context such as where you received it. Screenshots are optional. Do not include passwords, payment details, government identifiers, or other sensitive personal information in a public GitHub report."
                ]
            },
            {
                heading: "What happens next",
                paragraphs: [
                    "Reports are reviewed for policy, security, and legal concerns. A link may be disabled while it is investigated. Submitting a report does not guarantee removal, and the operator may request additional information."
                ]
            },
            {
                heading: "Immediate danger",
                paragraphs: [
                    "If someone is in immediate danger or the link relates to an urgent crime, contact the appropriate local emergency or law-enforcement service first."
                ]
            }
        ],
        primaryAction: {
            label: "Open an abuse report",
            href: "https://github.com/uditaswal/url-shortner/issues/new?title=Abuse%20report&labels=abuse-report"
        }
    }
};

export function getLegalPage(page) {
    return legalPages[page] || null;
}

