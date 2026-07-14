import React from 'react';
import { MetaFunction } from 'react-router';
const APP_NAME = "MetaForge Manager";
const COMPANY_NAME = "Galaxy Web Links";

export const meta: MetaFunction = () => [
    { title: `Privacy Policy | ${APP_NAME}` },
    {
        name: "description",
        content: `Privacy policy for ${APP_NAME}, a Shopify app by ${COMPANY_NAME}. Learn how merchant and customer data is collected, used, and protected.`,
    },
];

const TagMetafieldManagerPrivacy: React.FC = () => {

    return (
        <div style={styles.appFrameMain}>
            <main style={styles.main}>
                <article style={styles.article}>
                    {/* Header area mirroring the structural template */}
                    <header style={styles.header}>
                        <h1 style={styles.pageTitle}>Privacy Policy</h1>

                        <p style={{ ...styles.leadParagraph, marginTop: '0.5rem', color: '#6d7175' }}>
                            This Privacy Policy explains how Galaxy Web Links ("we", "us", or "our") collects, uses, and protects information when merchants use the <strong style={styles.strong}>MetaForge Manager</strong> application ("App").
                        </p>
                    </header>

                    {/* Section 1 */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>1. About the App</h2>
                        <p style={styles.p}>
                            MetaForge Manager is an embedded Shopify application that helps merchants manage tags and metafields across Shopify resources through bulk operations, imports, exports, and other management tools.
                        </p>
                        <p style={styles.p}>
                            The App is designed specifically to work within the Shopify Admin and assist merchants in managing store data efficiently.
                        </p>
                    </section>

                    {/* Section 2 */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>2. Who Can Access the App</h2>
                        <p style={styles.p}>
                            The App is available exclusively to:
                        </p>
                        <ul style={styles.ul}>
                            <li style={styles.li}>Shopify store owners (merchants)</li>
                            <li style={styles.li}>Authorized Shopify staff accounts with specific access permissions granted by the store owner</li>
                        </ul>
                        <p style={styles.p}>
                            Customers and public storefront visitors cannot access, interact with, or use the App under any circumstances.
                        </p>
                    </section>

                    {/* Section 3 */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>3. Information We Access</h2>
                        <p style={styles.p}>
                            When a merchant installs the App, we may access limited Shopify store information required for secure authentication and native app functionality, including:
                        </p>
                        <ul style={styles.ul}>
                            <li style={styles.li}>Store domain</li>
                            <li style={styles.li}>Shop ID</li>
                            <li style={styles.li}>Authentication and session tokens</li>
                            <li style={styles.li}>Shopify staff account information provided directly by Shopify</li>
                        </ul>
                        <p style={styles.p}>
                            This information is utilized strictly to provide secure access to the App and its specific internal modules.
                        </p>
                    </section>

                    {/* Section 4 */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>4. Resource Data Processing</h2>
                        <p style={styles.p}>
                            The App may process Shopify catalog resources such as products, collections, customers, orders, metafields, metaobjects, and tags when a merchant intentionally initiates an action within the App.
                        </p>
                        <p style={styles.p}>
                            We do not collect, copy, or store your store resources for unrelated purposes. Resource data is temporarily accessed only when strictly required to execute bulk tasks requested by the merchant.
                        </p>
                    </section>

                    {/* Section 5 */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>5. History Records</h2>
                        <p style={styles.p}>
                            To help merchants track, verify, and reverse actions performed through bulk operations, we may store operation history metrics, including:
                        </p>
                        <ul style={styles.ul}>
                            <li style={styles.li}>Action type (e.g., Add, Remove, Update)</li>
                            <li style={styles.li}>Processing status and runtime counts</li>
                            <li style={styles.li}>Target resource identifiers (GIDs)</li>
                            <li style={styles.li}>Exact date and time of execution</li>
                        </ul>
                        <p style={styles.p}>
                            These records are saved locally using Shopify's secure structures and are used solely for reporting, troubleshooting, and powering the internal Undo mechanism.
                        </p>
                    </section>

                    {/* Section 6 */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>6. How We Use Information</h2>
                        <p style={styles.p}>
                            We use the accessed information to:
                        </p>
                        <ul style={styles.ul}>
                            <li style={styles.li}>Authenticate merchants and authorized staff users safely</li>
                            <li style={styles.li}>Operate, maintain, and protect the App framework</li>
                            <li style={styles.li}>Perform requested bulk tag and metafield operations accurately</li>
                            <li style={styles.li}>Maintain the necessary operation history logs</li>
                            <li style={styles.li}>Provide effective customer and technical support</li>
                            <li style={styles.li}>Improve app performance, framework structure, and security mitigations</li>
                            <li style={styles.li}>Troubleshoot background technical issues</li>
                        </ul>
                        <p style={styles.p}>
                            <strong style={styles.strong}>We do not sell merchant data, nor do we use merchant information for external marketing or advertising profiles.</strong>
                        </p>
                    </section>

                    {/* Section 7 */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>7. Embedded Shopify App</h2>
                        <p style={styles.p}>
                            MetaForge Manager is built explicitly as an embedded Shopify Admin application. It functions natively and exclusively within the secure Shopify Admin environment and does not provide public storefront functionality or customer-facing trackers.
                        </p>
                    </section>

                    {/* Section 8 */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>8. Billing</h2>
                        <p style={styles.p}>
                            MetaForge Manager is currently free to use. The App does not contain hidden subscription plans, recurring charges, usage-based fee sheets, or locked paid functionalities.
                        </p>
                    </section>

                    {/* Section 9 */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>9. Data Security and Retention</h2>
                        <p style={styles.p}>
                            We deploy robust technical and organizational infrastructure to shield information, including secure handshake authentication, and standard Shopify access boundaries.
                        </p>
                        <p style={styles.p}>
                            Information is retained only for as long as necessary to provide core App components, manage user history tabs, handle support tickets, and comply with platform obligations. Data is automatically removed after the App is uninstalled in accordance with Shopify data deletion requirements.
                        </p>
                    </section>

                    {/* Contact Us Section */}
                    <section style={styles.section}>
                        <h2 style={styles.h2}>10. Contact Us</h2>
                        <p style={styles.p}>
                            If you have questions about this Privacy Policy, our data containment boundaries, or wish to seek operational support, please contact us:
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

                    {/* Footer section */}
                    <footer style={styles.footer}>
                        <p style={styles.footerText}>© 2026 Galaxy Web Links. All rights reserved.</p>
                    </footer>
                </article>
            </main>
        </div>
    );
};

// Styling structure converted to clean CSS objects matching Polaris style guides
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
        color: '#202223',
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

export default TagMetafieldManagerPrivacy;