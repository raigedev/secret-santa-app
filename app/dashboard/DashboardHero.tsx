type DashboardHeroProps = {
  displayFirstName: string;
  isDarkTheme: boolean;
  revealMessage: string;
};

export function DashboardHero({ displayFirstName, isDarkTheme, revealMessage }: DashboardHeroProps) {
  const heroTitleClass = isDarkTheme ? "text-white" : "text-sky-900";
  const heroSubtitleClass = isDarkTheme ? "text-slate-300" : "text-slate-600";

  return (
    <div data-fade className="mb-9 text-left">
      <h1 className={`text-4xl font-extrabold tracking-tight sm:text-[3.35rem] ${heroTitleClass}`}>
        Welcome back, {displayFirstName}
      </h1>
      <p className={`mt-2 text-[19px] ${heroSubtitleClass}`}>
        {revealMessage} <span aria-hidden="true">{"\uD83C\uDF84"}</span>
      </p>
    </div>
  );
}
