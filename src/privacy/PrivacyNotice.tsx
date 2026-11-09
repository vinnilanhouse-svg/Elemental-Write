import { ShieldCheck } from "lucide-react";
export function PrivacyLinks() {
  return (
    <span className="privacy-links">
      <a href="/privacidade.html" target="_blank" rel="noreferrer">
        Privacidade e armazenamento
      </a>
      <span aria-hidden="true">·</span>
      <a href="/termos.html" target="_blank" rel="noreferrer">
        Termos de uso
      </a>
    </span>
  );
}
export function PrivacyNotice({
  acknowledge,
  details,
}: {
  acknowledge: () => void;
  details: () => void;
}) {
  return (
    <section
      className="privacy-notice"
      aria-label="Aviso de privacidade e armazenamento"
    >
      <ShieldCheck size={21} aria-hidden="true" />
      <div>
        <strong>Seus dados neste navegador</strong>
        <p>
          Salvamos perfis e roteiros no seu navegador para o editor funcionar. A
          aplicação não instala cookies de publicidade ou análise.
        </p>
        <PrivacyLinks />
      </div>
      <div className="privacy-notice-actions">
        <button onClick={details}>Seus dados</button>
        <button className="primary" onClick={acknowledge}>
          Entendi
        </button>
      </div>
    </section>
  );
}
