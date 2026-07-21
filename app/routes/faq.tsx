import React from 'react';
import { MetaFunction } from 'react-router';
const APP_NAME = "MetaForge Manager";
const COMPANY_NAME = "Galaxy Web Links";

export const meta: MetaFunction = () => [
    { title: `FAQ | ${APP_NAME}` },
    {
        name: "description",
        content: `Frequently Asked Questions for ${APP_NAME}, a Shopify app by ${COMPANY_NAME}. Learn how the app works, how data is protected, and how bulk operations are performed.`,
    },
];

const TagMetafieldManagerFAQ: React.FC = () => {
    return (
        <div style={styles.appFrameMain}>
            <main style={styles.main}>
                <article style={styles.article}>
                    {/* Header area mirroring the privacy template layout */}
                    <header style={styles.header}>
                        <h1 style={styles.pageTitle}>Frequently Asked Questions</h1>
                        <p style={styles.leadParagraph}>
                            This FAQ guide explains how <strong style={styles.strong}>MetaForge Manager</strong> operates, protects your store data,
                            manages your metafield types, and handles bulk CSV tasks safely inside your Shopify ecosystem.
                        </p>
                    </header>

                    {/* Section 1 */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>1. What is MetaForge Manager?</h2>
                        <p style={styles.p}>
                            MetaForge Manager is a Shopify embedded app that lets you bulk add,
                            remove, and update tags and metafields across your store using CSV files.
                        </p>
                        <p style={styles.p}>
                            Data is stored securely using Shopify Metaobjects. No personal or
                            sensitive information is stored on external servers.
                        </p>
                    </section>

                    {/* Section 2 */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>2. How do Tag &amp; Metafield operations work?</h2>
                        <p style={styles.p}>
                            Tag and Metafield operations follow a simple and safe workflow:
                        </p>
                        <ol style={styles.ol}>
                            <li style={styles.li}>
                                <strong style={styles.strong}>Identify</strong> – Use GID, SKU, Handle, Order name, or Email in your CSV.
                            </li>
                            <li style={styles.li}>
                                <strong style={styles.strong}>Action</strong> – Add, Remove (Specific or Global).
                            </li>
                            <li style={styles.li}>
                                <strong style={styles.strong}>Review</strong> – Download a Result Sheet after completion.
                            </li>
                        </ol>
                    </section>

                    {/* Section 3 */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>3. How are different Metafield types handled?</h2>

                        <h3 style={styles.h3}>Single-Value Metafields</h3>
                        <p style={styles.p}>
                            Add or remove values via CSV, or remove them globally.
                        </p>

                        <h3 style={styles.h3}>List-Type Metafields</h3>
                        <p style={styles.p}>Choose to:</p>
                        <ul style={styles.ul}>
                            <li style={styles.li}>
                                <strong style={styles.strong}>Merge</strong> new values with existing values.
                            </li>
                            <li style={styles.li}>
                                <strong style={styles.strong}>Replace</strong> the entire list with new values.
                            </li>
                        </ul>

                        <h3 style={styles.h3}>File Reference Metafields</h3>
                        <p style={styles.p}>
                            Removal only. Uploads must be managed through Shopify Media.
                        </p>
                    </section>

                    {/* Section 4 */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>4. Can I undo an operation?</h2>
                        <p style={styles.p}>
                            Yes. The app includes a secure History &amp; Undo system.
                        </p>
                        <ul style={styles.ul}>
                            <li style={styles.li}>
                                Operations are stored for <strong style={styles.strong}>48 hours</strong>.
                            </li>
                            <li style={styles.li}>
                                Each operation can be undone <strong style={styles.strong}>only once</strong>.
                            </li>
                        </ul>
                    </section>

                    {/* Section 5 */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>5. What are the usage limits?</h2>

                        <h3 style={styles.h3}>CSV Limit</h3>
                        <p style={styles.p}>
                            Maximum <strong style={styles.strong}>5,000 records</strong> per file. Larger datasets
                            must be split into multiple files.
                        </p>

                        <h3 style={styles.h3}>Global Removal Limit</h3>
                        <p style={styles.p}>
                            Maximum <strong style={styles.strong}>5,000 resource entries</strong> can be processed at a time. If more entries are available, you can continue removing from the subsequent 5,000-entries.
                        </p>

                        <h3 style={styles.h3}>Important</h3>
                        <p style={styles.p}>
                            Keep the app tab open while an operation is running. Refreshing the page,
                            navigating away, or closing the tab will stop the operation.
                        </p>
                    </section>

                    {/* Section 6 */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>6. Can I export data for editing?</h2>
                        <p style={styles.p}>
                            Yes. You can export store data from all Shopify resources, including
                            user-created Metaobjects.
                        </p>
                        <p style={styles.p}>Exports help you:</p>
                        <ul style={styles.ul}>
                            <li style={styles.li}>Obtain accurate GIDs and identifiers.</li>
                            <li style={styles.li}>Edit values in Excel or Google Sheets.</li>
                            <li style={styles.li}>Upload the CSV back to perform bulk updates.</li>
                        </ul>
                    </section>

                    {/* Section 7 */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>7. What are the subscription plans?</h2>
                        <p style={styles.p}>
                            We offer three tiers of subscription plans:
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

                    {/* Contact Us Section */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>8. Contact Us</h2>

                        <p style={styles.p}>
                            If you have any questions, feedback, or require assistance with MetaForge Manager,
                            please contact our support team.
                        </p>

                        <div style={styles.contactCard}>
                            <p style={styles.contactItem}>
                                <strong style={styles.strongLabel}>App:</strong> MetaForge Manager
                            </p>

                            <p style={styles.contactItem}>
                                <strong style={styles.strongLabel}>Company:</strong> Galaxy Web Links
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
                                <strong style={styles.strongLabel}>Website:</strong>{" "}
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
                    {/* Footer section matching the template structure */}
                    <footer style={styles.footer}>
                        <p style={styles.footerText}>© {new Date().getFullYear()} Galaxy Web Links. All rights reserved.</p>
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

export default TagMetafieldManagerFAQ;