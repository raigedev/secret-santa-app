import { getGiftProgressStepIndex } from "./dashboard-formatters";
import { WishlistIcon } from "./dashboard-icons";
import type {
  GiftProgressStep,
  GiftProgressSummary,
} from "./dashboard-types";

const GIFT_PROGRESS_STEPS: Array<{ key: GiftProgressStep; label: string }> = [
  { key: "planning", label: "Planning" },
  { key: "purchased", label: "Purchased" },
  { key: "wrapped", label: "Wrapped" },
  { key: "ready_to_give", label: "Gift sent" },
];

type DashboardSidebarProps = {
  giftProgressSummary: GiftProgressSummary | null;
  isDarkTheme: boolean;
  wishlistGroupCount: number;
  wishlistItemCount: number;
  onGoGiftProgress: () => void;
  onGoWishlist: () => void;
};

export function DashboardSidebar({
  giftProgressSummary,
  isDarkTheme,
  wishlistGroupCount,
  wishlistItemCount,
  onGoGiftProgress,
  onGoWishlist,
}: DashboardSidebarProps) {
  const dashboardPanelHeadingClass = isDarkTheme ? "text-white" : "text-slate-900";
  const dashboardPanelTextClass = isDarkTheme ? "text-slate-300" : "text-slate-600";
  const currentGiftProgressIndex = giftProgressSummary
    ? getGiftProgressStepIndex(giftProgressSummary.focusStep)
    : -1;

  return (
    <aside className="space-y-8 lg:sticky lg:top-24">
      <section
        className={`relative overflow-hidden rounded-4xl p-8 shadow-[0_14px_32px_rgba(45,51,55,0.05)] ${
          isDarkTheme ? "bg-slate-900/82 text-slate-100" : "bg-white text-slate-900"
        }`}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2">
            <WishlistIcon className={isDarkTheme ? "h-5 w-5 text-rose-200" : "h-5 w-5 text-red-700"} />
            <h3 className="text-lg font-black">My Wishlist</h3>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${
              isDarkTheme ? "bg-slate-800 text-slate-300" : "bg-blue-50 text-blue-500"
            }`}
          >
            {wishlistItemCount} item{wishlistItemCount === 1 ? "" : "s"}
          </span>
        </div>
        <p className={`text-[15px] leading-7 ${dashboardPanelTextClass}`}>
          Help your Santa choose a gift you will like. {wishlistGroupCount} group{wishlistGroupCount === 1 ? "" : "s"} already use your wishlist ideas.
        </p>
        <button
          type="button"
          onClick={onGoWishlist}
          className="mt-7 flex w-full items-center justify-center rounded-full bg-[#c71824] px-5 py-4 text-[15px] font-extrabold text-white shadow-[0_16px_30px_rgba(199,24,36,0.20)] transition hover:-translate-y-0.5"
        >
          Manage Wishlist
        </button>
      </section>

      <section
        className={`rounded-4xl p-8 shadow-[0_14px_32px_rgba(45,51,55,0.05)] ${
          isDarkTheme ? "bg-slate-900/82 text-slate-100" : "bg-white text-slate-900"
        }`}
      >
        <h3 className="text-lg font-black">Gift Progress</h3>
        <div className="mt-5 space-y-4">
          {GIFT_PROGRESS_STEPS.map((step, index) => {
            const count = giftProgressSummary?.countsByStep[step.key] ?? 0;
            const isCurrent = giftProgressSummary ? index === currentGiftProgressIndex : index === 0;
            const isDone = giftProgressSummary ? count > 0 && index <= currentGiftProgressIndex : false;

            return (
              <div key={step.key} className="flex items-center gap-3">
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                    isDone || isCurrent
                      ? "bg-green-600 text-white"
                      : isDarkTheme
                        ? "bg-slate-800 text-slate-500"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {isDone ? "\u2713" : ""}
                </span>
                <span className={`text-[15px] font-extrabold ${isCurrent ? "text-green-600" : dashboardPanelHeadingClass}`}>
                  {step.label}
                </span>
                {isCurrent && count > 0 && (
                  <span
                    className={`ml-auto rounded-full px-2.5 py-1 text-[11px] font-black ${
                      isDarkTheme ? "bg-green-500/15 text-green-200" : "bg-green-50 text-green-700"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onGoGiftProgress}
          className={`mt-7 flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-extrabold transition hover:-translate-y-0.5 ${
            isDarkTheme ? "bg-slate-800 text-slate-100" : "bg-slate-50 text-slate-700"
          }`}
        >
          Open Gift Progress
        </button>
      </section>

    </aside>
  );
}
