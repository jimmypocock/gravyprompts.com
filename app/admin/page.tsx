"use client";

import { useState } from "react";
import AdminGuard from "@/components/admin/AdminGuard";
import ApprovalQueue from "@/components/admin/ApprovalQueue";
import PermissionsManager from "@/components/admin/PermissionsManager";
import ApprovalHistory from "@/components/admin/ApprovalHistory";
import { FileCheck, Users, History } from "lucide-react";

export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState<
    "approval" | "permissions" | "history"
  >("approval");

  return (
    <AdminGuard>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <nav className="space-y-1">
            <button
              onClick={() => setActiveSection("approval")}
              className={`${
                activeSection === "approval"
                  ? "bg-primary text-white"
                  : "text-gray-700 hover:bg-gray-100"
              } w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors`}
            >
              <FileCheck className="w-5 h-5 mr-3" />
              Template Approval
            </button>
            <button
              onClick={() => setActiveSection("permissions")}
              className={`${
                activeSection === "permissions"
                  ? "bg-primary text-white"
                  : "text-gray-700 hover:bg-gray-100"
              } w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors`}
            >
              <Users className="w-5 h-5 mr-3" />
              User Permissions
            </button>
            <button
              onClick={() => setActiveSection("history")}
              className={`${
                activeSection === "history"
                  ? "bg-primary text-white"
                  : "text-gray-700 hover:bg-gray-100"
              } w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors`}
            >
              <History className="w-5 h-5 mr-3" />
              Approval History
            </button>
          </nav>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {activeSection === "approval" && (
            <div>
              <h2 className="text-2xl font-bold mb-6">
                Template Approval Queue
              </h2>
              <ApprovalQueue />
            </div>
          )}

          {activeSection === "permissions" && (
            <div>
              <h2 className="text-2xl font-bold mb-6">User Permissions</h2>
              <PermissionsManager />
            </div>
          )}

          {activeSection === "history" && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Approval History</h2>
              <ApprovalHistory />
            </div>
          )}
        </div>
      </div>
    </AdminGuard>
  );
}
