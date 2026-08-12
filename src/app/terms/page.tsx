export const metadata = {
  title: "利用規約 | ゆるかけ",
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 text-stone-700">
      <h1 className="text-2xl font-bold text-brand-600">利用規約</h1>
      <p>
        この利用規約（以下「本規約」といいます）は、「ゆるかけ」（以下「本サービス」といいます）の利用条件を定めるものです。
        ユーザーの皆さまには、本規約に従って本サービスをご利用いただきます。
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-stone-900">第1条（適用）</h2>
        <p>
          本規約は、ユーザーと本サービス運営者との間の本サービスの利用に関わる一切の関係に適用されるものとします。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-stone-900">
          第2条（利用登録）
        </h2>
        <p>
          本サービスの利用を希望する方は、本規約に同意の上、所定の方法によって利用登録を行うものとします。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-stone-900">
          第3条（禁止事項）
        </h2>
        <p>
          ユーザーは、本サービスの利用にあたり、法令または公序良俗に違反する行為、
          他のユーザーまたは第三者の権利を侵害する行為、その他運営者が不適切と判断する行為を行ってはならないものとします。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-stone-900">
          第4条（本サービスの提供の停止等）
        </h2>
        <p>
          運営者は、システムの保守点検その他運営上または技術上の理由により、事前の予告なく本サービスの全部または一部の提供を停止または中断することができるものとします。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-stone-900">
          第5条（規約の変更）
        </h2>
        <p>
          運営者は、必要と判断した場合には、ユーザーに通知することなく本規約を変更できるものとします。
        </p>
      </section>

      <p className="text-sm text-stone-400">制定日：2026年8月12日</p>
    </article>
  );
}
