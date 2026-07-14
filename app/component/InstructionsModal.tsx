import { Modal, Text, BlockStack, List } from "@shopify/polaris";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AddTagsInstructionsModal({ open, onClose }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="How to Add Tags"
      primaryAction={{
        content: "Got it",
        onAction: onClose,
      }}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <Text as="p" variant="bodyMd">
            Follow these simple steps to add tags:
          </Text>

          <List type="number">
            <List.Item>
              <Text as="span">
                <Text as="span" fontWeight="semibold">
                  Select the resource type
                </Text>{" "}
                you want to update.
              </Text>
            </List.Item>

            <List.Item>
              <Text as="span">
                <Text as="span" fontWeight="semibold">
                  Enter some tags
                </Text>{" "}
                you want to add.
              </Text>
            </List.Item>

            <List.Item>
              <Text as="span">
                <Text as="span" fontWeight="semibold">
                  Match the resource
                </Text>{" "}
                using Shopify GID or a field from your CSV.
              </Text>
            </List.Item>

            <List.Item>
              <Text as="span">
                <Text as="span" fontWeight="semibold">
                  Download the sample CSV
                </Text>{" "}
                and make sure your file has the{" "}
                <Text as="span" fontWeight="semibold">
                  same format and headers
                </Text>.
              </Text>
            </List.Item>



            <List.Item>
              <Text as="span">
                Upload your CSV file  and click{" "}
                <Text as="span" fontWeight="semibold">
                  "Run Bulk Update"
                </Text>.
              </Text>
            </List.Item>

            <List.Item>
              <Text as="span">
                A{" "}
                <Text as="span" fontWeight="semibold">
                  preview popup
                </Text>{" "}
                will appear - review the data carefully.
              </Text>
            </List.Item>

            <List.Item>
              <Text as="span">
                <Text as="span" fontWeight="semibold">
                  Confirm the operation
                </Text>{" "}
                to start the update.
              </Text>
            </List.Item>

            <List.Item>
              <Text as="span">
                After completion,{" "}
                <Text as="span" fontWeight="semibold">
                  download the result CSV
                </Text>{" "}
                to check the final output.
              </Text>
            </List.Item>
          </List>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

export function RemoveTagsInstructionsModal({ open, onClose }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="How to Remove Tags"
      primaryAction={{
        content: "Got it",
        onAction: onClose,
      }}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <Text as="p" variant="bodyMd">
            Follow these steps to remove tags from your resources:
          </Text>

          <List type="number">
            <List.Item>
              <Text as="span">
                <Text as="span" fontWeight="semibold">
                  Select the resource type
                </Text>{" "}
                you want to update.
              </Text>
            </List.Item>

            <List.Item>
              <Text as="span">
                Apply filters using{" "}
                <Text as="span" fontWeight="semibold">
                  Match Type
                </Text>{" "}
                to find your tags.
              </Text>
            </List.Item>

            <List.Item>
              <Text as="span">
                <Text as="span" fontWeight="semibold">
                  Enter one or more tags
                </Text>{" "}
                (use{" "}
                <Text as="span" fontWeight="semibold">
                  "Add another tag"
                </Text>{" "}
                if needed).
              </Text>
            </List.Item>

            <List.Item>
              <Text as="span">
                Click{" "}
                <Text as="span" fontWeight="semibold">
                  "Fetch Tags"
                </Text>{" "}
                and{" "}
                <Text as="span" fontWeight="semibold">
                  select the tags
                </Text>{" "}
                you want to remove.
              </Text>
            </List.Item>

            <List.Item>
              <Text as="span">
                Use{" "}
                <Text as="span" fontWeight="semibold">
                  Global Remove
                </Text>{" "}
                to remove tags from up to 5,000 resources at once.
              </Text>
            </List.Item>

            <List.Item>
              <Text as="span">
                Or use the  CSV option in{" "}
                <Text as="span" fontWeight="semibold">
                  Specific Removal
                </Text>{" "}
              </Text>
            </List.Item>

            <List.Item>
              <Text as="span">
                Create your CSV using{" "}
                <Text as="span" fontWeight="semibold">
                  Global GID or a specific field
                </Text>{" "}
                and ensure it matches the{" "}
                <Text as="span" fontWeight="semibold">
                  sample format (headers must match)
                </Text>.
              </Text>
            </List.Item>

            <List.Item>
              <Text as="span">
                Click{" "}
                <Text as="span" fontWeight="semibold">
                  "Run Remove"
                </Text>{" "}
                and review the{" "}
                <Text as="span" fontWeight="semibold">
                  preview popup
                </Text>.
              </Text>
            </List.Item>

            <List.Item>
              <Text as="span">
                <Text as="span" fontWeight="semibold">
                  Confirm the action
                </Text>, track the progress, and{" "}
                <Text as="span" fontWeight="semibold">
                  download the result CSV
                </Text>{" "}
                after completion.
              </Text>
            </List.Item>
          </List>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

export function MetafieldManageInstructionsModal({ open, onClose }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="How to Manage Metafields"
      primaryAction={{
        content: "Got it",
        onAction: onClose,
      }}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <Text as="p" variant="bodyMd">
            Follow these steps to manage metafields:
          </Text>

          <List type="number">
            <List.Item>
              <Text as="span">
                <Text as="span" fontWeight="semibold">
                  Select the resource type
                </Text>{" "}
                and click{" "}
                <Text as="span" fontWeight="semibold">
                  "Fetch Metafields"
                </Text>{" "}
                to load available metafields.
              </Text>
            </List.Item>

            <List.Item>
              <Text as="span">
                Choose the{" "}
                <Text as="span" fontWeight="semibold">
                  metafield
                </Text>{" "}
                you want to manage.
              </Text>
            </List.Item>

            <List.Item>
              <Text as="span">
                Select an{" "}
                operation mode {" : "}
                <Text as="span" fontWeight="semibold">
                  Global Remove
                </Text>,{" "}
                <Text as="span" fontWeight="semibold">
                  Targeted Removal
                </Text>, or{" "}
                <Text as="span" fontWeight="semibold">
                  Bulk Update
                </Text>.
              </Text>
            </List.Item>

            <List.Item>
              <Text as="span">
                <Text as="span" fontWeight="semibold">
                  Global Remove
                </Text>{" "}
                will remove metafields from up to 5,000 resources at once.
              </Text>
            </List.Item>

            {/* 🔥 MERGED FLOW START */}
            <List.Item>
              <Text as="span">
                For{" "}
                <Text as="span" fontWeight="semibold">
                  Targeted Removal / Bulk Update
                </Text>, select a{" "}
                <Text as="span" fontWeight="semibold">
                  Match Type
                </Text>{" "}
                and create a CSV using{" "}
                <Text as="span" fontWeight="semibold">
                  Resource GID / Specific Field
                </Text>.
              </Text>
            </List.Item>

            <List.Item>
              <Text as="span">
                Make sure your CSV follows the{" "}
                <Text as="span" fontWeight="semibold">
                  sample format (headers must match exactly)
                </Text>.
              </Text>
            </List.Item>

            <List.Item>
              <Text as="span">
                Upload the CSV and click{" "}
                <Text as="span" fontWeight="semibold">
                  Run Action (Delete / Update)
                </Text>. A{" "}
                <Text as="span" fontWeight="semibold">
                  preview popup
                </Text>{" "}
                will appear.
              </Text>
            </List.Item>

            <List.Item>
              <Text as="span">
                After{" "}
                <Text as="span" fontWeight="semibold">
                  confirming the action
                </Text>, you can track the{" "}
                <Text as="span" fontWeight="semibold">
                  live progress
                </Text>.
              </Text>
            </List.Item>

            <List.Item>
              <Text as="span">
                Once completed,{" "}
                <Text as="span" fontWeight="semibold">
                  download the result CSV
                </Text>{" "}
                to review the output.
              </Text>
            </List.Item>
            {/* 🔥 MERGED FLOW END */}
            <List.Item>
              <Text as="span">
                Shopify also supports{" "}
                <Text as="span" fontWeight="semibold">
                  List metafields
                </Text>. For this, you get an extra option called{" "}
                <Text as="span" fontWeight="semibold">
                  "List Strategy"
                </Text>{" "}
                where you can{" "}
                <Text as="span" fontWeight="semibold">
                  add or remove specific values
                </Text>{" "}
                instead of updating the full list.
              </Text>
            </List.Item>
          </List>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}