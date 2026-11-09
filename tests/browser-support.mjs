export async function dismissPrivacyNotice(page) {
  const notice = page.getByRole("region", {
    name: "Aviso de privacidade e armazenamento",
    exact: true,
  });
  await notice.waitFor();
  await notice.getByRole("button", { name: "Entendi", exact: true }).click();
}
