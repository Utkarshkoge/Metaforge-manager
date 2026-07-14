import { Modal, IndexTable, Text, Box, Pagination, BlockStack, InlineStack } from "@shopify/polaris";
import { useState, useEffect } from "react";

interface CsvPreviewModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  data: any[];
  title?: string;
  confirmText?: string;
  destructive?: boolean;
  confirmationMessage?: React.ReactNode;
}

export default function CsvPreviewModal({ 
  open, 
  onClose, 
  onConfirm, 
  data, 
  title = "Confirm Action",
  confirmText = "Confirm",
  destructive = false,
  confirmationMessage
}: CsvPreviewModalProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  // Reset page when modal opens
  useEffect(() => {
    if (open) setCurrentPage(1);
  }, [open]);

  if (!data || data.length === 0) return null;

  // Extract headers from the first object, fallback to index if not an object
  const firstRow = data[0];
  let headers: { title: string }[] = [];
  let isArrayOfArrays = false;

  if (Array.isArray(firstRow)) {
    isArrayOfArrays = true;
    headers = firstRow.map((_, i) => ({ title: `Column ${i + 1}` }));
  } else if (typeof firstRow === 'object' && firstRow !== null) {
    headers = Object.keys(firstRow).map(key => ({ title: key }));
  } else {
    headers = [{ title: "Value" }];
  }

  const totalPages = Math.ceil(data.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const displayData = data.slice(startIndex, startIndex + rowsPerPage);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      primaryAction={{
        content: confirmText,
        onAction: onConfirm,
        destructive: destructive
      }}
      secondaryActions={[
        {
          content: "Cancel",
          onAction: onClose,
        },
      ]}
      size="large"
    >
      <Modal.Section>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="p" tone="subdued">
              Showing {startIndex + 1} to {Math.min(startIndex + rowsPerPage, data.length)} of {data.length} records.
            </Text>
            {totalPages > 1 && (
              <Pagination
                hasPrevious={currentPage > 1}
                onPrevious={() => setCurrentPage(prev => prev - 1)}
                hasNext={currentPage < totalPages}
                onNext={() => setCurrentPage(prev => prev + 1)}
              />
            )}
          </InlineStack>

          <Box paddingBlockStart="100">
            <div style={{ maxHeight: "400px", overflowY: "auto", overflowX: "auto" }}>
              <IndexTable
                resourceName={{ singular: 'row', plural: 'rows' }}
                itemCount={displayData.length}
                headings={headers as any}
                selectable={false}
              >
                {displayData.map((row, index) => {
                  let cells: any[] = [];
                  if (isArrayOfArrays) {
                    cells = row;
                  } else if (typeof row === 'object' && row !== null) {
                    cells = Object.values(row);
                  } else {
                    cells = [row];
                  }

                  const globalIndex = startIndex + index;
                  return (
                    <IndexTable.Row id={`row-${globalIndex}`} key={globalIndex} position={index}>
                      {cells.map((cellValue, i) => (
                        <IndexTable.Cell key={i}>
                          {cellValue === null || cellValue === undefined 
                            ? "" 
                            : typeof cellValue === 'object' 
                              ? JSON.stringify(cellValue) 
                              : String(cellValue)}
                        </IndexTable.Cell>
                      ))}
                    </IndexTable.Row>
                  );
                })}
              </IndexTable>
            </div>
          </Box>
          
          {confirmationMessage && (
            <Box paddingBlockStart="300">
              <Text as="p" fontWeight="medium">
                {confirmationMessage}
              </Text>
            </Box>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
