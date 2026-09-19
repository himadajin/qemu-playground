import { ActionIcon, Button, Center, Drawer, EmptyState, Group, Tabs, Text } from "@mantine/core";
import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { ImportSourceButton } from "./ImportSourceButton";
import { ResizableWorkspace } from "./ResizableWorkspace";
interface Props {
  narrow: boolean;
  sidebarOpen: boolean;
  drawerOpen: boolean;
  previewSelected: boolean;
  hasActive: boolean;
  mainTab: "code" | "result";
  otherRunningName: string | null;
  sidebar: ReactNode;
  editor: ReactNode;
  result: ReactNode;
  runButton: ReactNode;
  onToggleSidebar: () => void;
  onCloseDrawer: () => void;
  onTabChange: (tab: "code" | "result") => void;
  onNew: () => void;
  onImport: (file: File) => void;
}
export function ProgramLayout({
  narrow,
  sidebarOpen,
  drawerOpen,
  previewSelected,
  hasActive,
  mainTab,
  otherRunningName,
  sidebar,
  editor,
  result,
  runButton,
  onToggleSidebar,
  onCloseDrawer,
  onTabChange,
  onNew,
  onImport,
}: Props) {
  return (
    <>
      <div className="workbench">
        {!narrow && sidebarOpen && <aside className="sidebar">{sidebar}</aside>}
        <div className="workbench__main">
          <Group className="workbench__navigation" gap={8} py={5} px={12} wrap="nowrap">
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={narrow || !sidebarOpen ? "Show files" : "Hide files"}
              onClick={onToggleSidebar}
            >
              {!narrow && sidebarOpen ? (
                <IconLayoutSidebarLeftCollapse size={18} />
              ) : (
                <IconLayoutSidebarLeftExpand size={18} />
              )}
            </ActionIcon>
            <Text size="xs" c="dimmed">
              {previewSelected ? "Shared preview" : "Independent programs"}
            </Text>
          </Group>
          {!hasActive ? (
            <Center component="main" flex={1} p={24}>
              <EmptyState
                size="sm"
                title="Start with a program"
                description="Create a C or assembly file to begin."
              >
                <EmptyState.Actions>
                  <Button size="xs" onClick={onNew}>
                    New file
                  </Button>
                  <ImportSourceButton inEmptyState onImport={onImport} />
                </EmptyState.Actions>
              </EmptyState>
            </Center>
          ) : narrow ? (
            <Tabs
              className="workspace workspace--stacked"
              value={mainTab}
              onChange={(value) => {
                if (value) onTabChange(value as "code" | "result");
              }}
              keepMounted
              keepMountedMode="display-none"
            >
              <div className="mobile-run-bar">
                <Tabs.List aria-label="Workspace">
                  <Tabs.Tab value="code">Code</Tabs.Tab>
                  <Tabs.Tab value="result">Result</Tabs.Tab>
                </Tabs.List>
                {otherRunningName && (
                  <span className="mobile-run-bar__status" role="status">
                    Running {otherRunningName}…
                  </span>
                )}
                {runButton}
              </div>
              <Tabs.Panel className="workspace__panel" value="code">
                {editor}
              </Tabs.Panel>
              <Tabs.Panel className="workspace__panel" value="result">
                {result}
              </Tabs.Panel>
            </Tabs>
          ) : (
            <ResizableWorkspace code={editor} result={result} />
          )}
        </div>
      </div>
      <Drawer
        opened={!!narrow && drawerOpen}
        onClose={onCloseDrawer}
        title="Your programs"
        size={280}
        styles={{ body: { height: "calc(100% - 64px)", padding: 0 } }}
      >
        {sidebar}
      </Drawer>
    </>
  );
}
