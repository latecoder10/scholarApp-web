/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Sparkles, ChevronRight, CheckCircle2, BookOpen } from "lucide-react";
import { EXAM_REGISTRY, ALL_TRACKS_OPTION } from "../../shared/exams";
import { getExamIcon, getExamColorClasses } from "../lib/examTheme";

const SELECTABLE_EXAMS = [...EXAM_REGISTRY, ALL_TRACKS_OPTION];

interface ExamSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedExamId: string;
  onSelectExam: (examId: string) => void;
}

export default function ExamSelectorModal({
  isOpen,
  onClose,
  selectedExamId,
  onSelectExam
}: ExamSelectorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Modal Header */}
        <div className="bg-white border-b border-slate-100 p-6 sm:p-8">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="p-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600 inline-flex">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="text-xs font-semibold tracking-wide text-indigo-600 uppercase">
              Choose your track
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-slate-900">
            Which exam are you preparing for?
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-1.5 max-w-xl">
            You can switch tracks anytime from the top navigation bar.
          </p>
        </div>

        {/* Exam Cards Grid */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-4 flex-1">
          {SELECTABLE_EXAMS.map((exam) => {
            const isSelected = selectedExamId === exam.id;
            const Icon = getExamIcon(exam);
            const colors = getExamColorClasses(exam);

            return (
              <div
                key={exam.id}
                onClick={() => {
                  onSelectExam(exam.id);
                  onClose();
                }}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative group flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-50/40 shadow-md ring-2 ring-indigo-600/10"
                    : "border-slate-200/80 bg-white hover:border-indigo-300 hover:bg-slate-50/60 shadow-3xs"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl shrink-0 mt-0.5 border ${colors.iconBg} ${colors.iconText} ${colors.iconBorder}`}>
                    <Icon className="w-6 h-6" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display font-bold text-slate-900 text-base group-hover:text-indigo-600 transition-colors">
                        {exam.name}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide border ${colors.badgeBg} ${colors.badgeText} ${colors.badgeBorder}`}>
                        {exam.badge}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2">
                      {exam.description}
                    </p>

                    <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-slate-400" />
                        {exam.category}
                      </span>
                      <span>•</span>
                      <span className="text-indigo-600 font-semibold">
                        {exam.shortName}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  {isSelected ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-100/70 px-3 py-1.5 rounded-lg border border-indigo-200">
                      <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                      Selected
                    </div>
                  ) : (
                    <button className="flex items-center gap-1 text-xs font-bold text-slate-600 group-hover:text-indigo-600 transition-colors px-3 py-1.5 rounded-lg border border-slate-200 group-hover:border-indigo-200 bg-white">
                      Select <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            You can change this anytime
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer border border-slate-300/80"
          >
            Continue with Selection
          </button>
        </div>
      </div>
    </div>
  );
}
