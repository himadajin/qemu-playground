import {
  ActionIcon,
  Box,
  Button,
  Center,
  Drawer,
  EmptyState,
  Flex,
  Group,
  Tabs,
} from "@mantine/core";
import { IconLayoutSidebarLeftExpand } from "@tabler/icons-react";
import { useLocalStorage } from "@mantine/hooks";
import type { ReactNode } from "react";
import { ImportSourceButton } from "./ImportSourceButton";
import { SidebarLayout } from "./SidebarLayout";
import { Sidebar, SidebarToggle } from "./Sidebar";
import { FileSidebarRail } from "./FileSidebarRail";
export const RESULTS_OPEN_STORAGE_KEY = "qemu-playground:results-open:v1";
interface Props {
  narrow: boolean;
  sidebarOpen: boolean;
  drawerOpen: boolean;
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
  const [resultsOpen, setResultsOpen] = useLocalStorage({
    key: RESULTS_OPEN_STORAGE_KEY,
    defaultValue: true,
    getInitialValueInEffect: false,
    sync: false,
    serialize: String,
    deserialize: (value) => value !== "false",
  });
  const workbench = (
    <div className="workbench__main">
      {narrow && !hasActive && (
        <Group className="workbench__navigation" gap={8} py={5} px={12} wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Show files"
            onClick={onToggleSidebar}
          >
            <IconLayoutSidebarLeftExpand size={18} />
          </ActionIcon>
        </Group>
      )}
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
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="Show files"
              aria-expanded={drawerOpen}
              onClick={onToggleSidebar}
            >
              <IconLayoutSidebarLeftExpand size={18} />
            </ActionIcon>
            <Tabs.List aria-label="Workspace">
              <Tabs.Tab value="code">Code</Tabs.Tab>
              <Tabs.Tab value="result">Console</Tabs.Tab>
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
        <main className="workspace workspace__panel">{editor}</main>
      )}
    </div>
  );

  return (
    <>
      <Flex flex={1} mih={0}>
        {narrow ? (
          workbench
        ) : (
          <SidebarLayout
            opened={sidebarOpen}
            sidebar={
              <Sidebar
                side="left"
                opened={sidebarOpen}
                contentId="desktop-files"
                actions={
                  <FileSidebarRail
                    opened={sidebarOpen}
                    onToggle={onToggleSidebar}
                    onNew={onNew}
                    onImport={onImport}
                  />
                }
              >
                {sidebar}
              </Sidebar>
            }
            results={
              hasActive
                ? {
                    opened: resultsOpen,
                    content: (
                      <Sidebar
                        side="right"
                        opened={resultsOpen}
                        contentId="desktop-results"
                        actions={
                          <div className="sidebar__actions">
                            <SidebarToggle
                              side="right"
                              opened={resultsOpen}
                              iconOnly
                              controls="desktop-results"
                              label={resultsOpen ? "Collapse results" : "Expand results"}
                              onToggle={() => setResultsOpen((value) => !value)}
                            />
                          </div>
                        }
                      >
                        {result}
                      </Sidebar>
                    ),
                  }
                : undefined
            }
          >
            {workbench}
          </SidebarLayout>
        )}
      </Flex>
      <Drawer
        opened={!!narrow && drawerOpen}
        onClose={onCloseDrawer}
        title="Your programs"
        withCloseButton={false}
        size="min(280px, calc(100vw - 32px))"
        styles={{ header: { display: "none" }, body: { height: "100%", padding: 0 } }}
      >
        <Flex direction="column" h="100%" data-opened="true" className="sidebar-drawer">
          <FileSidebarRail
            opened
            drawer
            onToggle={onCloseDrawer}
            onNew={onNew}
            onImport={onImport}
          />
          <Box id="drawer-files" flex={1} mih={0}>
            {sidebar}
          </Box>
        </Flex>
      </Drawer>
    </>
  );
}
