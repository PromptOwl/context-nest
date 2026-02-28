"use client";

import React from "react";
import {
  FileText,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Shield,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReviewQueue, StewardAssignmentModal, StewardList } from "../stewardship";
import { cn } from "@/lib/utils";
import { useContextDashboard } from "@/hooks/useContextDashboard";
import type { DocumentLifecycleStatus } from "@/db/models/dataRoomDocument";

interface ContextDashboardProps {
  userId: string;
  userEmail: string;
  dataRoomId: string;
}

export function ContextDashboard({
  userId,
  userEmail,
  dataRoomId,
}: ContextDashboardProps) {
  const {
    stats,
    recentDocuments,
    stewards,
    stewardsLoading,
    showStewardModal,
    fetchDashboardData,
    fetchStewards,
    formatDate,
    handleNavigateToTimeline,
    handleNavigateToNewDocument,
    handleNavigateToDocuments,
    handleNavigateToDocument,
    handleOpenStewardModal,
    handleCloseStewardModal,
  } = useContextDashboard({ userId, userEmail, dataRoomId });

  const getStatusIcon = (status: DocumentLifecycleStatus) => {
    switch (status) {
      case "draft":
        return <FileText className="h-4 w-4 text-gray-500" />;
      case "pending_review":
        return <Clock className="h-4 w-4 text-amber-500" />;
      case "approved":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "rejected":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="md:py-6 wrapper" data-testid="context-dashboard">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-2 sm:gap-4 mb-4 mt-14 md:mt-0">
        <h3>My Context</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleNavigateToTimeline}
            data-testid="view-timeline-button"
          >
            <History className="h-4 w-4 mr-2" />
            Timeline
          </Button>
          <Button
            variant="outline"
            onClick={handleOpenStewardModal}
            data-testid="assign-steward-button"
          >
            <Shield className="h-4 w-4 mr-2" />
            Manage Stewards
          </Button>
          <Button
            onClick={handleNavigateToNewDocument}
            data-testid="new-document-button"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Document
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Documents</CardDescription>
            <CardTitle className="text-3xl">{stats?.totalDocuments || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>In your context</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Review</CardDescription>
            <CardTitle className="text-3xl text-amber-600">{stats?.pendingReview || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Awaiting approval</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>AI Ready</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats?.approvedDocuments || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              <span>Approved for AI</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Review Queue</CardDescription>
            <CardTitle className="text-3xl text-blue-600">{stats?.myReviewQueue || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>Need your review</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
        {/* Left Column */}
        <div className="space-y-3">
          {/* Recent Documents */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Recent Documents</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNavigateToDocuments}
                >
                  View All
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentDocuments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No documents yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={handleNavigateToNewDocument}
                  >
                    Create your first document
                  </Button>
                </div>
              ) : (
                <div className="">
                  {recentDocuments.map((doc) => (
                    <div
                      key={doc._id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => handleNavigateToDocument(doc._id)}
                      data-testid={`recent-doc-${doc._id}`}
                    >
                      {getStatusIcon(doc.lifecycleStatus)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{doc.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>v{doc.version}</span>
                          <span>•</span>
                          <span>{formatDate(doc.updatedAt)}</span>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          doc.lifecycleStatus === "approved" && "bg-green-100 text-green-700",
                          doc.lifecycleStatus === "pending_review" && "bg-amber-100 text-amber-700",
                          doc.lifecycleStatus === "draft" && "bg-gray-100 text-gray-700",
                          doc.lifecycleStatus === "rejected" && "bg-red-100 text-red-700"
                        )}
                      >
                        {(doc.lifecycleStatus || "draft").replace("_", " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stewards Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Context Stewards</CardTitle>
                  <CardDescription>
                    Users who can approve documents in your context
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenStewardModal}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <StewardList
                stewards={stewards}
                loading={stewardsLoading}
                showScope
                onAddSteward={handleOpenStewardModal}
                onRefresh={fetchStewards}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Review Queue */}
        <div>
          <ReviewQueue
            dataRoomId={dataRoomId}
            showHeader
            maxItems={10}
            onReviewComplete={fetchDashboardData}
          />
        </div>
      </div>

      {/* Steward Assignment Modal */}
      <StewardAssignmentModal
        isOpen={showStewardModal}
        onClose={handleCloseStewardModal}
        dataRoomId={dataRoomId}
        onAssigned={fetchDashboardData}
      />
    </div>
  );
}

export default ContextDashboard;
