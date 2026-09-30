"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { AdminHeader } from "@/components/admin/admin-header";
import { Search, Shield, User, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@clerk/nextjs";

export default function AdminUsersPage() {
  const { user: currentClerkUser } = useUser();
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Selected user for role change dialog
  const [roleModalUser, setRoleModalUser] = useState(null);
  const [updatingRole, setUpdatingRole] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        role: roleFilter,
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load user directory.");
      }
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
        setPagination(data.pagination);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, roleFilter, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleUpdate = async (targetUserId, newRole) => {
    setUpdatingRole(true);
    setActionSuccess(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${targetUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update role.");
      }
      setActionSuccess(`Role updated to '${newRole}' for user.`);
      setRoleModalUser(null);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingRole(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 w-full overflow-y-auto flex flex-col">
        <AdminHeader
          title="User Directory & Access Control"
          subtitle="Manage platform users, inspect activity totals, and assign administrator privileges"
        />

        <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Action alerts */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {actionSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Filters & Search Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search users by name, email, or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 text-xs font-medium">
                {["all", "admin", "user"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`px-3 py-1 rounded-md capitalize transition-colors ${
                      roleFilter === r
                        ? "bg-purple-600 text-white font-semibold"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                    }`}
                  >
                    {r === "all" ? "All Roles" : r}
                  </button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchUsers}
                disabled={loading}
                className="text-xs gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                  <tr>
                    <th className="px-6 py-3.5">User</th>
                    <th className="px-4 py-3.5">Role</th>
                    <th className="px-4 py-3.5 text-center">Docs</th>
                    <th className="px-4 py-3.5 text-center">Questions</th>
                    <th className="px-4 py-3.5 text-center">AI Tokens</th>
                    <th className="px-4 py-3.5">Joined</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {users.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                        No users match the search criteria.
                      </td>
                    </tr>
                  )}

                  {users.map((u) => {
                    const isSelf = currentClerkUser?.id === u.id;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs uppercase">
                              {(u.name?.[0] || u.email?.[0] || "U")}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-white truncate">
                                {u.name || "Unnamed"} {isSelf && <span className="text-[10px] text-purple-600 font-normal">(You)</span>}
                              </p>
                              <p className="text-[11px] text-slate-400 font-mono truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          {u.role === "admin" ? (
                            <Badge className="bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 gap-1 text-[10px]">
                              <Shield className="w-3 h-3" />
                              Admin
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1 text-[10px] text-slate-600">
                              <User className="w-3 h-3" />
                              User
                            </Badge>
                          )}
                        </td>

                        <td className="px-4 py-4 text-center font-mono text-slate-600 dark:text-slate-300">
                          {u.stats.documentCount}
                        </td>
                        <td className="px-4 py-4 text-center font-mono text-slate-600 dark:text-slate-300">
                          {u.stats.questionsCount}
                        </td>
                        <td className="px-4 py-4 text-center font-mono text-slate-600 dark:text-slate-300">
                          {u.stats.tokensUsed > 0 ? u.stats.tokensUsed.toLocaleString() : "0"}
                        </td>

                        <td className="px-4 py-4 text-slate-400 text-[11px]">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => setRoleModalUser(u)}
                          >
                            Change Role
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Change Role Modal */}
        {roleModalUser && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Update User Privileges
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select new platform role for <strong>{roleModalUser.name || roleModalUser.email}</strong>
                </p>
              </div>

              {currentClerkUser?.id === roleModalUser.id && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-[11px] text-amber-800 dark:text-amber-300">
                  ⚠️ <strong>Self-Demotion Disabled:</strong> You cannot remove your own administrator privileges. Another administrator must perform this action.
                </div>
              )}

              <div className="space-y-2 pt-2">
                <Button
                  className="w-full justify-start gap-2 text-xs"
                  variant={roleModalUser.role === "admin" ? "default" : "outline"}
                  disabled={updatingRole || roleModalUser.role === "admin"}
                  onClick={() => handleRoleUpdate(roleModalUser.id, "admin")}
                >
                  <Shield className="w-4 h-4 text-purple-600" />
                  <span>Promote to Administrator</span>
                </Button>

                <Button
                  className="w-full justify-start gap-2 text-xs"
                  variant={roleModalUser.role === "user" ? "default" : "outline"}
                  disabled={
                    updatingRole ||
                    roleModalUser.role === "user" ||
                    currentClerkUser?.id === roleModalUser.id
                  }
                  onClick={() => handleRoleUpdate(roleModalUser.id, "user")}
                >
                  <User className="w-4 h-4 text-slate-500" />
                  <span>Demote to Regular User</span>
                </Button>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setRoleModalUser(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
