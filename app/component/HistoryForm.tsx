import {
  IndexTable,
  Text,
  Badge,
  Button,
  Pagination,
  EmptyState,
  Modal,
  BlockStack,
  Scrollable,
  InlineStack,
  Spinner,
  LegacyCard,
  useIndexResourceState,
} from "@shopify/polaris";
import {
  RotateLeftIcon,
  ViewIcon
} from "@shopify/polaris-icons";

export interface Log {
  id: string;
  userName: string;
  operation: string;
  objectType: string;
  value: any[];
  restore: boolean;
  time: string;
}

interface LogsTableProps {
  logs: Log[];
  openRow: number | null;
  setOpenRow: (row: number | null) => void;
  handleRestore: (log: Log) => void;
  isLoading: boolean;
  onNext: () => void;
  onPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
  isDbCreated: boolean;
  onCreateDb: () => void;
}

interface RecentProps {
  logs: Log[];
  openRow: number | null;
  setOpenRow: (row: number | null) => void;
  handleRestore: (log: Log) => void;
  isLoading: boolean;
}

export function LogsTable({ logs, openRow, setOpenRow, handleRestore, isLoading, onNext, onPrev, hasNext, hasPrev, isDbCreated, onCreateDb }: LogsTableProps) {

  const resourceName = {
    singular: 'log',
    plural: 'logs',
  };

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState((logs || []) as any[]);

  if (isLoading) {
    return (
      <LegacyCard sectioned>
        <div className="flex flex-col items-center justify-center py-12">
          <Spinner size="large" />
          <div className="mt-4">
            <Text as="p" variant="bodyMd" tone="subdued">Loading History...</Text>
          </div>
        </div>
      </LegacyCard>
    );
  }

  if (!isDbCreated) {
    return (
      <LegacyCard sectioned>
        <EmptyState
          heading="Database Required"
          action={{
            content: 'Create Database',
            onAction: onCreateDb,
          }}
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>A database is required to track your history and enable restore functionality. Please create one to continue.</p>
        </EmptyState>
      </LegacyCard>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <LegacyCard sectioned>
        <EmptyState
          heading="No activity yet"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>Your bulk operation history and restore points will appear here once you perform some actions.</p>
        </EmptyState>
      </LegacyCard>
    );
  }

  const rowMarkup = logs.map(
    (log, index) => (
      <IndexTable.Row
        id={log.id}
        key={log.id}
        selected={selectedResources.includes(log.id)}
        position={index}
      >
        {/* <IndexTable.Cell>
          <InlineStack gap="200" align="start" blockAlign="center">
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
              <User size={14} />
            </div>
            <Text as="span" variant="bodyMd" fontWeight="bold">
              {log.userName || "Unknown User"}
            </Text>
          </InlineStack>
        </IndexTable.Cell> */}
        <IndexTable.Cell>
          <InlineStack gap="300" align="start" blockAlign="center">
            {/* The Action: Strong and clear */}
            <Text as="span" variant="bodyMd" fontWeight="bold">
              {log.operation}
            </Text>

            {/* The Object: Styled as a Badge for better visual separation */}
            <Badge tone="info" progress="complete">
              {log.objectType}
            </Badge>
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Button
            variant="plain"
            onClick={() => setOpenRow(index)}
            icon={ViewIcon}
          >
            View Details
          </Button>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Button
            onClick={() => handleRestore(log)}
            disabled={!log.restore}
            icon={RotateLeftIcon}
            variant="primary"
          >
            Undo
          </Button>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <BlockStack gap="050" align="end">
            <Text as="span" variant="bodySm" alignment="end">
              {new Date(log.time).toLocaleDateString()}
            </Text>
            <Text as="span" variant="bodyXs" tone="subdued" alignment="end">
              {new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </BlockStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  const currentLog = openRow !== null ? logs[openRow] : null;
  return (
    <LegacyCard>
      <IndexTable
        resourceName={resourceName}
        itemCount={logs.length}
        selectedItemsCount={
          allResourcesSelected ? 'All' : selectedResources.length
        }
        onSelectionChange={handleSelectionChange}
        headings={[
          // { title: 'User' },
          { title: 'Operation' },
          { title: 'Details' },
          { title: 'Action' },
          { title: 'Timestamp', alignment: 'end' },
        ]}
        selectable={false}
      >
        {rowMarkup}
      </IndexTable>

      <div className="flex items-center justify-center p-4 border-t border-gray-200">
        <Pagination
          hasPrevious={hasPrev}
          onPrevious={onPrev}
          hasNext={hasNext}
          onNext={onNext}
        />
      </div>

      {/* Details Modal */}
      {currentLog && (
        <Modal
          open={openRow !== null}
          onClose={() => setOpenRow(null)}
          title={`Operation Details - Total [${currentLog.value?.length || 0}]`}
          size="large"
        >
          <Modal.Section>
            <LogDetailsContent log={currentLog} />
          </Modal.Section>
        </Modal>
      )}
    </LegacyCard>
  );
}

function LogDetailsContent({ log }: { log: Log }) {
  return (
    <BlockStack gap="200">
      <Scrollable shadow style={{ maxHeight: '400px' }}>
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-white sticky top-0 shadow-sm z-10">
            <tr>
              <th className="px-4 py-2 font-semibold text-gray-600 border-b border-gray-200 bg-white">
                Resource ID
              </th>
              {log.operation === "Tags-removed" || log.operation === "Tags-Added" ? (
                <th className="px-4 py-2 font-semibold text-gray-600 border-b border-gray-200 bg-white">
                  {log.operation === "Tags-Added" ? "Tags Added" : "Tags Removed"}
                </th>
              ) : (
                <>
                  <th className="px-4 py-2 font-semibold text-gray-600 border-b border-gray-200 bg-white">Key</th>
                  <th className="px-4 py-2 font-semibold text-gray-600 border-b border-gray-200 bg-white">Value</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {log.value?.map((v: any, i: number) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-blue-600 text-xs">
                  {v.id}
                </td>
                {log.operation === "Tags-removed" || log.operation === "Tags-Added" ? (
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(log.operation === "Tags-removed"
                        ? v.removedTags
                        : v.tagList?.split(","))?.map((tag: string, idx: number) => (
                          <Badge
                            key={idx}
                            tone={log.operation === "Tags-removed" ? "critical" : "success"}
                          >
                            {tag.trim()}
                          </Badge>
                        ))}
                    </div>
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-3">
                      <BlockStack gap="050">
                        <Text as="span" variant="bodySm" fontWeight="medium">
                          {v.data?.key}
                        </Text>
                        <Text as="span" variant="bodyXs" tone="subdued">
                          {typeof v.data?.type === "object"
                            ? v.data?.type?.name
                            : v.data?.type}
                        </Text>
                      </BlockStack>
                    </td>
                    <td className="px-4 py-3">
                      <pre className="whitespace-pre-wrap text-xs bg-gray-50 p-2 rounded border border-gray-200 text-gray-700 font-mono">
                        {v.data?.value || "—"}
                      </pre>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Scrollable>
    </BlockStack >
  );
}

export function Recent({ logs, openRow, setOpenRow, handleRestore, isLoading }: RecentProps) {

  const resourceName = {
    singular: 'log',
    plural: 'logs',
  };

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState((logs || []) as any[]);

  if (isLoading) {
    return (
      <LegacyCard sectioned>
        <div className="flex flex-col items-center justify-center py-12">
          <Spinner size="large" />
          <div className="mt-4">
            <Text as="p" variant="bodyMd" tone="subdued">Loading Recent activities...</Text>
          </div>
        </div>
      </LegacyCard>
    );
  }



  if (!logs || logs.length === 0) {
    return (
      <LegacyCard sectioned>
        <EmptyState
          heading="No activity yet"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>Your bulk operation history and restore points will appear here once you perform some actions.</p>
        </EmptyState>
      </LegacyCard>
    );
  }

  const rowMarkup = logs.map(
    (log, index) => (
      <IndexTable.Row
        id={log.id}
        key={log.id}
        selected={selectedResources.includes(log.id)}
        position={index}
      >

        <IndexTable.Cell>
          <InlineStack gap="300" align="start" blockAlign="center">
            {/* The Action: Strong and clear */}
            <Text as="span" variant="bodyMd" fontWeight="bold">
              {log.operation}
            </Text>

            {/* The Object: Styled as a Badge for better visual separation */}
            <Badge tone="info" progress="complete">
              {log.objectType}
            </Badge>
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Button
            variant="plain"
            onClick={() => setOpenRow(index)}
            icon={ViewIcon}
          >
            View Details
          </Button>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Button
            onClick={() => handleRestore(log)}
            disabled={!log.restore}
            icon={RotateLeftIcon}
            variant="primary"
          >
            Undo
          </Button>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <BlockStack gap="050" align="end">
            <Text as="span" variant="bodySm" alignment="end">
              {new Date(log.time).toLocaleDateString()}
            </Text>
            <Text as="span" variant="bodyXs" tone="subdued" alignment="end">
              {new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </BlockStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  const currentLog = openRow !== null ? logs[openRow] : null;
  return (
    <LegacyCard>
      <IndexTable
        resourceName={resourceName}
        itemCount={logs.length}
        selectedItemsCount={
          allResourcesSelected ? 'All' : selectedResources.length
        }
        onSelectionChange={handleSelectionChange}
        headings={[
          // { title: 'User' },
          { title: 'Operation' },
          { title: 'Details' },
          { title: 'Action' },
          { title: 'Timestamp', alignment: 'end' },
        ]}
        selectable={false}
      >
        {rowMarkup}
      </IndexTable>


      {/* Details Modal */}
      {currentLog && (
        <Modal
          open={openRow !== null}
          onClose={() => setOpenRow(null)}
          title={`Operation Details - Total [${currentLog.value?.length || 0}]`}
          size="large"
        >
          <Modal.Section>
            <LogDetailsContent log={currentLog} />
          </Modal.Section>
        </Modal>
      )}
    </LegacyCard>
  );
}

