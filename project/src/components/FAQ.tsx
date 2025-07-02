import React from 'react';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { useStore } from '../store';
import { translations } from '../i18n';
import type { Store } from '../store';

interface FAQProps {
  onBack: () => void;
}

interface FAQSection {
  title: string;
  questions: {
    question: string;
    answer: string;
  }[];
}

export function FAQ({ onBack }: FAQProps) {
  const { language } = useStore() as Store;
  const t = translations[language as keyof typeof translations];

  const faqSections: FAQSection[] = [
    {
      title: t.faqSection1Title,
      questions: [
        { question: t.faqQuestion1, answer: t.faqAnswer1 },
        { question: t.faqQuestion2, answer: t.faqAnswer2 },
        { question: t.faqQuestion3, answer: t.faqAnswer3 },
      ],
    },
    {
      title: t.faqSection2Title,
      questions: [
        { question: t.faqQuestion4, answer: t.faqAnswer4 },
        { question: t.faqQuestion5, answer: t.faqAnswer5 },
        { question: t.faqQuestion6, answer: t.faqAnswer6 },
      ],
    },
    {
      title: t.faqSection3Title,
      questions: [
        { question: t.faqQuestion7, answer: t.faqAnswer7 },
        { question: t.faqQuestion8, answer: t.faqAnswer8 },
        { question: t.faqQuestion9, answer: t.faqAnswer9 },
        { question: t.faqQuestion14, answer: t.faqAnswer14 },
      ],
    },
    {
      title: t.faqSection4Title,
      questions: [
        { question: t.faqQuestion10, answer: t.faqAnswer10 },
        { question: t.faqQuestion11, answer: t.faqAnswer11 },
        { question: t.faqQuestion12, answer: t.faqAnswer12 },
        { question: t.faqQuestion13, answer: t.faqAnswer13 },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
      <div className="bg-line-gradient text-white sticky top-0">
        <div className="container mx-auto px-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 py-4"
          >
            <ArrowLeft size={20} />
            {t.back}
          </button>
          <h1 className="text-2xl font-bold pb-6">{t.faqTitle}</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="prose max-w-none">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {faqSections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="border-b border-gray-200 last:border-none">
                <h3 className="text-xl font-bold p-6 bg-gray-50">{section.title}</h3>
                {section.questions.map((qa, qaIndex) => (
                  <details
                    key={qaIndex}
                    className="group border-t border-gray-200 first:border-none"
                  >
                    <summary className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50">
                      <span className="font-medium text-gray-900">{qa.question}</span>
                      <ChevronDown 
                        className="w-5 h-5 text-gray-500 transition-transform group-open:rotate-180" 
                      />
                    </summary>
                    <div className="px-6 pb-6 text-gray-600 whitespace-pre-line">
                      {qa.answer}
                    </div>
                  </details>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}