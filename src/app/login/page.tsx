import LoginForm from "./LoginForm";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirectedFrom?: string };
}) {
  return <LoginForm redirectTo={searchParams.redirectedFrom || "/mypage"} />;
}
