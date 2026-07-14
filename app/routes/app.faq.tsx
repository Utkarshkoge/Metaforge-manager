import { useState } from "react";
import { useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import {
  HelpCircle,
  Tag,
  Database,
  History,
  ChevronDown,
  FileText,
  AlertCircle,
  Download,
  RotateCcw,
  Clock,
} from "lucide-react";
import type { LoaderFunctionArgs } from "react-router";
import { HomeIcon } from "@shopify/polaris-icons";
import { Icon, Page, Text } from "@shopify/polaris";
import { RouteErrorBoundary } from "../component/RouteErrorBoundary";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

interface FaqItemProps {
  question: string;
  answer: React.ReactNode;
  icon?: React.ElementType;
  isOpen: boolean;
  onClick: () => void;
}

const FaqItem = ({ question, answer, icon: Icon, isOpen, onClick }: FaqItemProps) => {
  return (
    <div
      className={`bg-white rounded-lg border transition-all duration-300 overflow-hidden ${isOpen
        ? 'border-black shadow-md ring-1 ring-black/5'
        : 'border-[#e0e2e4] hover:border-black/30 hover:shadow-sm'
        }`}
    >
      <button
        onClick={onClick}
        className="w-full flex items-center justify-between p-3 text-left bg-white transition-colors cursor-pointer group"
      >
        <div className="flex items-center gap-4">
          {Icon && (
            <div className={`p-2 rounded-md border shrink-0 transition-all ${isOpen
              ? 'bg-black text-white border-black shadow-sm'
              : 'bg-gray-50 border-gray-100 text-gray-500 group-hover:text-black group-hover:border-gray-200'
              }`}>
              <Icon size={16} strokeWidth={2} />
            </div>
          )}
          <span className={`font-semibold text-[14px] transition-colors ${isOpen ? 'text-black' : 'text-[#202223] group-hover:text-black'
            }`}>
            {question}
          </span>
        </div>
        <div className={`ml-4 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-black' : 'group-hover:text-gray-600'}`}>
          <ChevronDown size={18} />
        </div>
      </button>
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
          }`}
      >
        <div className="px-4 pb-4 pt-0 text-sm text-gray-600 leading-relaxed">
          <div className="pt-4 border-t border-gray-100">
            {answer}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function FaqPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const navigate = useNavigate();

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const faqs = [
    {
      question: "What is MetaForge Manager?",
      icon: HelpCircle,
      answer: (
        <div className="space-y-3">
          <p className="text-sm text-gray-800">
            <strong>MetaForge Manager</strong> is a Shopify embedded app that lets you
            bulk add, remove, and update <strong>tags and metafields</strong> across your store
            using CSV files.
          </p>
          <p className="text-xs text-gray-600">
            Data is stored securely using <strong>Shopify Metaobjects</strong>. No personal or
            sensitive information is stored on external servers.
          </p>
        </div>
      ),
    },

    {
      question: "How do Tag & Metafield operations work?",
      icon: Tag,
      answer: (
        <div className="space-y-3">
          <p className="text-sm text-gray-800">
            Tag and Metafield operations follow a simple and safe workflow:
          </p>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <ol className="list-decimal pl-4 space-y-2 text-sm text-gray-700">
              <li>
                <strong>Identify:</strong> Use GID, SKU, Handle, Order name, or Email in your CSV.
              </li>
              <li>
                <strong>Action:</strong> Add, Remove (Specific or Global), Merge, or Replace values.
              </li>
              <li>
                <strong>Review:</strong> Download a <strong>Result Sheet</strong> after completion.
              </li>
            </ol>
          </div>
        </div>
      ),
    },

    {
      question: "How are different Metafield types handled?",
      icon: Database,
      answer: (
        <div className="space-y-3">
          <ul className="space-y-2 text-sm text-gray-700">
            <li>
              <strong>Single-Value:</strong> Add or remove values via CSV, or remove globally.
            </li>
            <li>
              <strong>List-Type:</strong> Choose to <strong>Merge</strong> (append) new values or
              <strong> Replace</strong> the entire list.
            </li>
            <li>
              <strong>File References:</strong> <span className="text-red-600 font-medium">Removal only</span>.
              Uploads must be handled through Shopify Media.
            </li>
          </ul>
        </div>
      ),
    },

    {
      question: "Can I undo an operation?",
      icon: History,
      answer: (
        <div className="space-y-3">
          <p className="text-sm text-gray-800">
            Yes. The app includes a secure <strong>History & Undo</strong> system.
          </p>

          <div className="grid gap-2">
            <div className="flex items-center gap-2 text-sm bg-blue-50 p-2 rounded border border-blue-100">
              <Clock className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Operations are stored for <strong>48 hours</strong>.</span>
            </div>

            <div className="flex items-center gap-2 text-sm bg-orange-50 p-2 rounded border border-orange-100">
              <RotateCcw className="w-4 h-4 text-orange-600 shrink-0" />
              <span>Each operation can be undone <strong>only once</strong>.</span>
            </div>
          </div>
        </div>
      ),
    },

    {
      question: "What are the usage limits?",
      icon: AlertCircle,
      answer: (
        <div className="space-y-3">
          <div className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm">
            <FileText className="w-5 h-5 text-gray-600 mt-0.5 shrink-0" />
            <p>
              <strong>CSV Limit:</strong> Maximum <strong>5,000 records</strong> per file.
              Larger datasets must be split.
            </p>
          </div>

          <div className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm">
            <Database className="w-5 h-5 text-gray-600 mt-0.5 shrink-0" />
            <p>
              <strong>Global Removal Limit:</strong> Maximum <strong>5,000 resource entries</strong> can be processed at a time. If more entries are available, you can continue removing from the subsequent 5,000-entries.
            </p>
          </div>

          <div className="flex items-start gap-3 bg-red-50 p-3 rounded-lg border border-red-100 text-sm">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
            <p className="text-red-900 font-medium">
              <strong>Important:</strong> Keep the app tab open. Refreshing, navigating away,
              or closing the tab will stop the operation.
            </p>
          </div>
        </div>
      ),
    },

    {
      question: "Can I export data for editing?",
      icon: Download,
      answer: (
        <div className="space-y-2">
          <p className="text-sm text-gray-800">
            Yes. You can <strong>export store data</strong> from all Shopify resources,
            including user-created Metaobjects.
          </p>
          <p className="text-xs text-gray-600">
            Use exports to get accurate GIDs or identifiers, edit values in Excel or Sheets,
            and upload the CSV back for bulk updates.
          </p>
        </div>
      ),
    },
  ];


  return (
    <Page>
      <div className="flex flex-col space-y-1.5 mb-5 rounded-sm">
        {/* Header Row */}

        <div className="flex items-center space-x-2">
          {/* Home Icon Button */}
          <button
            onClick={() => navigate("/app")}
            className="flex items-center cursor-pointer justify-center text-[#303030] hover:opacity-70 transition-opacity focus:outline-none"
            aria-label="Go to Home"
          >
            <Icon source={HomeIcon} />
          </button>

          {/* Vertical Divider */}
          <span
            className="h-5 w-px bg-[#D2D2D2]"
            aria-hidden="true"
          />

          {/* Title */}
          <div className="text-xl font-bold leading-tight">
            Frequently Asked Questions
          </div>
        </div>



        <Text as="p" variant="bodySm" tone="subdued">
          Everything you need to know about managing your store's data with{" "}
          <span className="font-semibold text-black">MetaForge Manager</span>.
        </Text>

      </div>

      <div className="space-y-4" >
        {faqs.map((faq, index) => (
          <div key={index} className="transition-all duration-200 hover:translate-y-[-1px]">
            <FaqItem
              question={faq.question}
              answer={faq.answer}
              icon={faq.icon}
              isOpen={openIndex === index}
              onClick={() => toggleFaq(index)}
            />
          </div>
        ))}
      </div>
    </Page>
  );
}

export function ErrorBoundary() {
  return <RouteErrorBoundary routeName="FAQ" />;
}

