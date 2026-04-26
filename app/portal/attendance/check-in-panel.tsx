"use client";

import { useTransition } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, Clock, LogIn, LogOut } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { checkInAction, checkOutAction } from "./actions";

type Props = {
  checkedIn: boolean;
  checkedOut: boolean;
  checkIn: string | null;
  checkOut: string | null;
};

export function CheckInPanel({
  checkedIn,
  checkedOut,
  checkIn,
  checkOut,
}: Props) {
  const [pending, start] = useTransition();

  async function onCheckIn() {
    start(async () => {
      const res = await checkInAction();
      if (res?.error) toast.error(res.error);
      else toast.success("تم تسجيل الحضور");
    });
  }

  async function onCheckOut() {
    start(async () => {
      const res = await checkOutAction();
      if (res?.error) toast.error(res.error);
      else toast.success("تم تسجيل الانصراف");
    });
  }

  return (
    <div className="bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-primary-900/30 dark:via-gray-900 dark:to-secondary-900/30 border border-primary-100 dark:border-primary-900/60 rounded-2xl p-5 sm:p-6 md:p-7 shadow-sm">
      <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-50 mb-1">
            {checkedIn ? "يومك بدأ" : "ابدأ يومك"}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {checkedIn
              ? `حضرت الساعة ${formatTime(checkIn)} ${
                  checkedOut ? `• انصرفت ${formatTime(checkOut)}` : ""
                }`
              : "اضغط لتسجيل حضورك الآن."}
          </p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={onCheckIn}
            disabled={pending || checkedIn}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 bg-primary-600 text-white rounded-xl font-semibold shadow-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            {checkedIn ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {checkedIn ? "تم الحضور" : "تسجيل الحضور"}
          </button>
          <button
            onClick={onCheckOut}
            disabled={pending || !checkedIn || checkedOut}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 border-2 border-gray-200 dark:border-gray-700 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            {checkedOut ? (
              <Clock className="w-4 h-4" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
            {checkedOut ? "تم الانصراف" : "تسجيل الانصراف"}
          </button>
        </div>
      </div>
    </div>
  );
}
