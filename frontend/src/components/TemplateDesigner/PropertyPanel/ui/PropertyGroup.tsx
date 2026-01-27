import React from "react";

export const PropertyGroup: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <div className="space-y-3 rounded-xl border bg-background p-4">
    <h4 className="text-sm font-semibold">{title}</h4>
    {children}
  </div>
);
