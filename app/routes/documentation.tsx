import React from 'react';
const APP_NAME = "MetaForge Manager";
const COMPANY_NAME = "Galaxy WebLinks";
import { MetaFunction } from 'react-router';


export const meta: MetaFunction = () => [
    { title: `Documentation | ${APP_NAME}` },
    {
        name: "description",
        content: `App Documentation for ${APP_NAME}, a Shopify app by ${COMPANY_NAME}. Learn how the app works, how data is protected, and how bulk operations are performed.`,
    },
];
const TagMetafieldManagerDocumentation: React.FC = () => {
    return (
        <div style={styles.appFrameMain}>
            <main style={styles.main}>
                <article style={styles.article}>
                    {/* Header area mirroring the template layout */}
                    <header style={styles.header}>
                        <h1 style={styles.pageTitle}>App Documentation</h1>
                        <p style={styles.leadParagraph}>
                            Welcome to the official documentation for <strong style={styles.strong}>MetaForge Manager</strong>.
                            Learn how to efficiently manage your store's tags, metafields, and bulk operations natively within Shopify.
                        </p>
                    </header>

                    {/* Section 1: Overview */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>1. Introduction &amp; Overview</h2>
                        <p style={styles.p}>
                            MetaForge Manager is a Shopify CLI–based embedded app designed for managing tags and metafields.
                            It offers a centralized solution for bulk adding, updating, and removing tags and metafield values
                            across multiple Shopify resources.
                        </p>
                        <p style={styles.p}>
                            Built entirely with Shopify Polaris, the app provides a native Shopify Admin experience, ensuring seamless integration with your existing workflow.
                        </p>
                    </section>

                    {/* Section 2: Data Safety & History */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>2. Data Safety &amp; History</h2>
                        <p style={styles.p}>
                            Your store's data integrity is our highest priority. The app operates with strict data safety boundaries:
                        </p>
                        <ul style={styles.ul}>
                            <li style={styles.li}>
                                <strong style={styles.strong}>Secure Storage:</strong> Operational data is stored securely inside your store using Shopify Metaobjects. No personal or sensitive information is ever transferred to or stored on external servers.
                            </li>
                            <li style={styles.li}>
                                <strong style={styles.strong}>Transparency:</strong> Users can download a comprehensive result sheet after every operation to review exactly what changes were made.
                            </li>
                        </ul>
                    </section>

                    {/* Section 3: Tag Features */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>3. Tag Management</h2>
                        <p style={styles.p}>
                            Streamline your organizational workflow by performing bulk updates across your store catalog.
                        </p>

                        <h3 style={styles.h3}>Add Tags via CSV</h3>
                        <p style={styles.p}>
                            Bulk add tags using a structured CSV file.
                        </p>
                        <ul style={styles.ul}>
                            <li style={styles.li}><strong style={styles.strong}>Supported Resources:</strong> Products, Customers, Orders, and Blog Posts.</li>
                            <li style={styles.li}><strong style={styles.strong}>CSV Identification:</strong> Identify items using their unique Resource ID (GID) or resource-specific identifiers (e.g., handles, SKUs).</li>
                        </ul>

                        <h3 style={styles.h3}>Remove Tags</h3>
                        <p style={styles.p}>
                            Clean up or re-organize your store structure easily.
                        </p>
                        <ul style={styles.ul}>
                            <li style={styles.li}>Remove tags selectively from specific resources using a targeted CSV file.</li>
                            <li style={styles.li}>Perform a global clean up to remove a specific tag from all resources where it is currently present.</li>
                        </ul>
                    </section>

                    {/* Section 4: Metafield Features */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>4. Metafield Management</h2>
                        <p style={styles.p}>
                            The Metafield Manager allows managing metafield values natively after fetching and selecting a specific metafield definition. Different types are handled securely:
                        </p>

                        <h3 style={styles.h3}>Single-Value Metafields</h3>
                        <ul style={styles.ul}>
                            <li style={styles.li}>Add or remove values from specific resources using a CSV (identified by GID or unique identifier).</li>
                            <li style={styles.li}>Completely strip and remove values from all resources globally.</li>
                        </ul>

                        <h3 style={styles.h3}>List-Type Metafields</h3>
                        <ul style={styles.ul}>
                            <li style={styles.li}>Remove all values entirely from all resources.</li>
                            <li style={styles.li}>Remove values from specific resources (either the entire list or specific individual list items).</li>
                            <li style={styles.li}><strong style={styles.strong}>Merge Option:</strong> Append new values to your existing metafield list.</li>
                            <li style={styles.li}><strong style={styles.strong}>Replace Option:</strong> Overwrite and replace the entire list with your new values.</li>
                        </ul>

                        <h3 style={styles.h3}>File Reference Metafields</h3>
                        <ul style={styles.ul}>
                            <li style={styles.li}>Only bulk removal from resources is supported. New file uploads and asset additions must be managed directly via Shopify Media.</li>
                        </ul>
                    </section>

                    {/* Section 5: Exporting Data */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>5. Exporting Store Data</h2>
                        <p style={styles.p}>
                            The app lets you export current store data from all Shopify resources—including user-created Metaobjects.
                        </p>
                        <p style={styles.p}>
                            This is ideal for grabbing accurate GIDs and unique identifiers, modifying values inside software like Excel or Google Sheets, and re-uploading the resulting CSV back into the app to run updates. Downloadable templates are available to ensure correct file formatting.
                        </p>
                    </section>

                    {/* Section 6: History & Undo Engine */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>6. Operation History &amp; Undo Mechanism</h2>
                        <p style={styles.p}>
                            Mistakes happen, which is why the app features a database-backed history and safety engine:
                        </p>
                        <ul style={styles.ul}>
                            <li style={styles.li}>
                                <strong style={styles.strong}>Time Window:</strong> Full histories and details—including operation types, target resources, statuses, timestamps, and result summaries—are visible for <strong style={styles.strong}>48 hours</strong> before automatic deletion.
                            </li>
                            <li style={styles.li}>
                                <strong style={styles.strong}>One-Time Undo:</strong> Any successful operation can be reverted and undone within that 48-hour window. Each operation can be undone <strong style={styles.strong}>only once</strong>.
                            </li>
                        </ul>
                    </section>

                    {/* Section 7: Limitations */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>7. Limitations &amp; Usage Guidelines</h2>

                        <h3 style={styles.h3}>CSV File Size Limit</h3>
                        <p style={styles.p}>
                            There is a maximum limit of <strong style={styles.strong}>5,000 records</strong> per CSV upload. If your store data exceeds this amount, simply split your dataset into multiple smaller CSV files.
                        </p>

                        <h3 style={styles.h3}>Active App Sessions</h3>
                        <p style={styles.p}>
                            Operations execute exclusively during an active browser session. You <strong style={styles.strong}>must keep the app tab open</strong> while an operation is running.
                            Refreshing the page, navigating away, or closing the browser window will interrupt processing and cause failure or partial execution.
                        </p>
                    </section>

                    {/* Section 8: Subscription Plans */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>8. Subscription Plans</h2>
                        <p style={styles.p}>
                            MetaForge Manager offers flexible subscription plans to suit your store's growth and data management needs:
                        </p>

                        <h3 style={styles.h3}>Starting 7 Days Free Plan</h3>
                        <ul style={styles.ul}>
                            <li style={styles.li}>2 Global Tag Removal Actions (50 items/run, max 2 tags)</li>
                            <li style={styles.li}>2 Global Metafield Removal Actions (100 items/run)</li>
                            <li style={styles.li}>200 CSV Entries per operation</li>
                            <li style={styles.li}>Export All Resources</li>
                            <li style={styles.li}>Standard Support</li>
                        </ul>

                        <h3 style={styles.h3}>Basic Plan ($5 / month)</h3>
                        <ul style={styles.ul}>
                            <li style={styles.li}>20 Global Tag Removal Actions (100 items/run, max 10 tags)</li>
                            <li style={styles.li}>20 Global Metafield Removal Actions (250 items/run)</li>
                            <li style={styles.li}>3,000 CSV Entries per operation</li>
                            <li style={styles.li}>Export All Resources</li>
                            <li style={styles.li}>Standard Support</li>
                        </ul>

                        <h3 style={styles.h3}>Advanced Plan ($10 / month)</h3>
                        <ul style={styles.ul}>
                            <li style={styles.li}>Unlimited Tag Removal (5,000 items/run, max 20 tags)</li>
                            <li style={styles.li}>Unlimited Metafield Removal (5,000 items/run)</li>
                            <li style={styles.li}>Unlimited CSV Operations (5,000 entries/run)</li>
                            <li style={styles.li}>Export All Resources</li>
                            <li style={styles.li}>Priority Support</li>
                        </ul>
                    </section>

                    {/* Conclusion / Contact Card */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>9. Conclusion &amp; Support</h2>
                        <p style={styles.p}>
                            MetaForge Manager provides a powerful, fast, and secure environment for bulk data optimization, backstopped by a flexible history system.
                        </p>

                        <div style={styles.contactCard}>
                            <p style={styles.contactItem}>
                                <strong style={styles.strongLabel}>App Ecosystem:</strong> MetaForge Manager
                            </p>
                            <p style={styles.contactItem}>
                                <strong style={styles.strongLabel}>Developed By:</strong> Galaxy WebLinks
                            </p>
                            <p style={styles.contactItem}>
                                <strong style={styles.strongLabel}>Email:</strong>{" "}
                                <a
                                    href="appsupport@galaxyweblinks.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={styles.link}
                                >
                                    appsupport@galaxyweblinks.com
                                </a>
                            </p>
                            <p style={styles.contactItem}>
                                <strong style={styles.strongLabel}>Support Website:</strong>{" "}
                                <a
                                    href="https://www.galaxyweblinks.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={styles.link}
                                >
                                    www.galaxyweblinks.com
                                </a>
                            </p>
                        </div>
                    </section>

                    {/* Footer Section */}
                    <footer style={styles.footer}>
                        <p style={styles.footerText}>© {new Date().getFullYear()} Galaxy WebLinks. All rights reserved.</p>
                    </footer>
                </article>
            </main>
        </div>
    );
};

// Styling structure converted to react clean CSS system
const styles: Record<string, React.CSSProperties> = {
    appFrameMain: {
        width: '100%',
        backgroundColor: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    },
    main: {
        display: 'block',
    },
    article: {
        maxWidth: '780px',
        margin: '0 auto',
        padding: '4rem 1.5rem 6rem 1.5rem',
        color: '#202223',
    },
    header: {
        marginBottom: '3rem',
        borderBottom: '1px solid #e1e3e5',
        paddingBottom: '2rem',
    },
    pageTitle: {
        fontSize: '2.25rem',
        fontWeight: 700,
        lineHeight: '2.75rem',
        color: '#1a1c1d',
        margin: '0 0 1rem 0',
        letterSpacing: '-0.025em',
    },
    leadParagraph: {
        fontSize: '1.125rem',
        lineHeight: '1.75rem',
        color: '#6d7175',
        margin: 0,
    },
    section: {
        marginBottom: '2.5rem',
    },
    h2: {
        fontSize: '1.375rem',
        fontWeight: 600,
        lineHeight: '1.875rem',
        color: '#1a1c1d',
        margin: '2rem 0 1rem 0',
    },
    h3: {
        fontSize: '1.05rem',
        fontWeight: 600,
        lineHeight: '1.5rem',
        color: '#202223',
        margin: '1.5rem 0 0.5rem 0',
    },
    p: {
        fontSize: '1rem',
        lineHeight: '1.625rem',
        color: '#454f5b',
        margin: '0 0 1rem 0',
    },
    ul: {
        paddingLeft: '1.5rem',
        margin: '0 0 1.25rem 0',
        listStyleType: 'disc',
    },
    ol: {
        paddingLeft: '1.5rem',
        margin: '0 0 1.25rem 0',
        listStyleType: 'decimal',
    },
    li: {
        fontSize: '1rem',
        lineHeight: '1.625rem',
        color: '#454f5b',
        marginBottom: '0.5rem',
    },
    strong: {
        fontWeight: 600,
        color: '#1a1c1d',
    },
    footer: {
        borderTop: '1px solid #e1e3e5',
        paddingTop: '2rem',
    },
    footerText: {
        fontSize: '0.875rem',
        color: '#8c9196',
        margin: 0,
    },
    contactCard: {
        marginTop: '1rem',
        padding: '1.25rem',
        border: '1px solid #e1e3e5',
        borderRadius: '8px',
        backgroundColor: '#f9fafb',
    },
    contactItem: {
        margin: '0 0 0.75rem 0',
        color: '#454f5b',
        fontSize: '1rem',
    },
    strongLabel: {
        fontWeight: 600,
        color: '#1a1c1d',
    },
    link: {
        color: '#005bd3',
        textDecoration: 'none',
    },
};

export default TagMetafieldManagerDocumentation;