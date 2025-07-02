import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useStore } from '../store';
import { translations } from '../i18n';

interface PrivacyPolicyProps {
  onBack: () => void;
}

export function PrivacyPolicy({ onBack }: PrivacyPolicyProps) {
  const { language } = useStore();
  const t = translations[language];

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
          <h1 className="text-2xl font-bold pb-6">{t.privacyTitle}</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="prose max-w-none">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-8">
              <p className="text-gray-600 mb-4">{t.privacyEffectiveDate}</p>
              <p className="mb-4">{t.privacyIntro}</p>
              <p>{t.termsAgreement}</p>
            </div>

            <hr className="my-8" />

            <section className="mb-8">
              <h3 className="text-xl font-bold mb-4">1. {t.termsSection1Title}</h3>
              <p className="mb-4">{t.termsServiceContent}</p>
              <ul className="list-disc pl-5 space-y-2 mb-4">
                <li>{t.termsAccountRegistration}</li>
                <li>{t.termsCompanyAuthorization}</li>
              </ul>
              <p>{t.termsInternationalUsage}</p>
            </section>

            <hr className="my-8" />

            <section className="mb-8">
              <h3 className="text-xl font-bold mb-4">2. {t.termsSection2Title}</h3>
              <p className="mb-4">{t.termsServiceContent}</p>
              <ul className="list-disc pl-5 space-y-2 mb-4">
                <li>{t.termsAccountRegistration}</li>
                <li>{t.termsCompanyAuthorization}</li>
                <li>{t.termsDeviceCompatibility}</li>
              </ul>
              <p>{t.termsCustomerResponsibility}</p>
            </section>

            <hr className="my-8" />

            <section className="mb-8">
              <h3 className="text-xl font-bold mb-4">3. {t.termsSection3Title}</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">{t.termsAccountRegistration}</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>{t.termsServiceContent}</li>
                    <li>{t.termsDeviceCompatibility}</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">{t.termsCompanyAuthorization}</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>{t.termsServiceContent}</li>
                    <li>{t.termsDeviceCompatibility}</li>
                  </ul>
                </div>
              </div>
            </section>

            <hr className="my-8" />

            <section className="mb-8">
              <h3 className="text-xl font-bold mb-4">4. {t.termsSection4Title}</h3>
              <p className="mb-4">{t.termsCostAndPayment}</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>{t.termsRefundPolicy}</li>
                <li>{t.termsRefundRequest}</li>
                <li>{t.termsRefundApproval}</li>
              </ul>
            </section>

            <hr className="my-8" />

            <section className="mb-8">
              <h3 className="text-xl font-bold mb-4">5. {t.termsSection5Title}</h3>
              <p className="mb-4">{t.termsESIMActivation}</p>
              <p>{t.termsCustomerResponsibility}</p>
            </section>

            <hr className="my-8" />

            <section className="mb-8">
              <h3 className="text-xl font-bold mb-4">6. {t.termsSection6Title}</h3>
              <p className="mb-4">{t.termsRefundRequest}</p>
              <div>
                <p className="mb-2">{t.termsRefundExceptions}</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>{t.termsRefundException1}</li>
                  <li>{t.termsRefundException2}</li>
                  <li>{t.termsRefundException3}</li>
                  <li>{t.termsRefundException4}</li>
                  <li>{t.termsRefundException5}</li>
                </ul>
              </div>
              <p>{t.termsRefundApproval}</p>
            </section>

            <hr className="my-8" />

            <section className="mb-8">
              <h3 className="text-xl font-bold mb-4">7. {t.termsSection7Title}</h3>
              <p>{t.termsCustomerResponsibility}</p>
            </section>

            <hr className="my-8" />

            <section className="mb-8">
              <h3 className="text-xl font-bold mb-4">8. {t.termsSection8Title}</h3>
              <p>{t.termsInternationalUsage}</p>
            </section>

            <hr className="my-8" />

            <section className="mb-8">
              <h3 className="text-xl font-bold mb-4">9. {t.termsSection9Title}</h3>
              <p>{t.termsTermsChanges}</p>
            </section>

            <hr className="my-8" />

            <section className="mb-8">
              <h3 className="text-xl font-bold mb-4">10. {t.termsSection11Title}</h3>
              <p className="whitespace-pre-wrap text-black text-base">{t.termsSection11Content}</p>
            </section>

            <hr className="my-8" />

            <section className="mb-8">
              <h3 className="text-xl font-bold mb-4">11. {t.termsSection12Title}</h3>
              <p className="whitespace-pre-wrap text-black text-base">{t.termsSection12Content}</p>
            </section>

            <hr className="my-8" />

            <section className="mb-8">
              <h3 className="text-xl font-bold mb-4">12. {t.termsSection13Title}</h3>
              <p className="whitespace-pre-wrap text-black text-base">{t.termsSection13Content}</p>
            </section>

            <hr className="my-8" />

            <section>
              <h3 className="text-xl font-bold mb-4">13. {t.termsSection10Title}</h3>
              <p className="mb-4">{t.termsContactUs}</p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-semibold">{t.termsCompanyName}</p>
                <p>{t.termsEmail}</p>
                <p>{t.termsAddress}</p>
                <p>{t.termsServiceTime}</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}