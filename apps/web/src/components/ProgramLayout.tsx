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
import type { ReactNode } from "react";
import { ImportSourceButton } from "./ImportSourceButton";
import { ResizableSidebarLayout } from "./ResizableSidebarLayout";
import { ResizableWorkspace } from "./ResizableWorkspace";
import { FileSidebarRail } from "./FileSidebarRail";
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
  );

  return (
    <>
      <Flex flex={1} mih={0}>
        {narrow ? (
          workbench
        ) : (
          <ResizableSidebarLayout
            opened={sidebarOpen}
            sidebar={
              <Flex
                component="aside"
                direction="column"
                className="sidebar"
                data-opened={sidebarOpen}
                h="100%"
                w="100%"
                mih={0}
              >
                <FileSidebarRail
                  opened={sidebarOpen}
                  onToggle={onToggleSidebar}
                  onNew={onNew}
                  onImport={onImport}
                />
                <Box
                  id="desktop-files"
                  className="sidebar__files"
                  flex={1}
                  mih={0}
                  inert={!sidebarOpen}
                  aria-hidden={!sidebarOpen}
                >
                  {sidebar}
                </Box>
              </Flex>
            }
          >
            {workbench}
          </ResizableSidebarLayout>
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
