import { ReactNode } from "react";

interface CtaBannerProps {
  icon: ReactNode;
  label: string;
  title: string;
  description: ReactNode;
  children: ReactNode;
}

export const CtaBanner = ({ icon, label, title, description, children }: CtaBannerProps) => {
  return (
    <div className="bg-primary text-primary-foreground rounded-3xl p-8 md:p-16 relative overflow-hidden">
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-2 text-primary-foreground/90">
            {icon}
            <span className="text-xs uppercase tracking-wider font-semibold">
              {label}
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            {title}
          </h2>
          <p className="text-primary-foreground/85 mt-2">
            {description}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 lg:flex-shrink-0">
          {children}
        </div>
      </div>

      {/* Decorative circles */}
      <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
    </div>
  );
};
