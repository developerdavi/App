import Onyx from 'react-native-onyx';
import {render} from '@testing-library/react-native';
import SidebarLinks from '../../src/pages/home/sidebar/SidebarLinks';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import {LocaleContextProvider} from '../../src/components/withLocalize';

// Be sure to include the mocked Permissions and Expensicons libraries or else the beta tests won't work
jest.mock('../../src/libs/Permissions');
jest.mock('../../src/components/Icon/Expensicons');

const ONYXKEYS = {
    PERSONAL_DETAILS: 'personalDetails',
    NVP_PRIORITY_MODE: 'nvp_priorityMode',
    SESSION: 'session',
    BETAS: 'betas',
    COLLECTION: {
        REPORT: 'report_',
        REPORT_ACTIONS: 'reportActions_',
        REPORT_IOUS: 'reportIOUs_',
    },
    NETWORK: 'network',
};

Onyx.init({
    keys: ONYXKEYS,
    registerStorageEventListener: () => {},
});

function getDefaultRenderedSidebarLinks() {
    // Wrap the SideBarLinks inside of LocaleContextProvider so that all the locale props
    // are passed to the component. If this is not done, then all the locale props are missing
    // and there are a lot of render warnings. It needs to be done like this because normally in
    // our app (App.js) is when the react application is wrapped in the context providers
    return render((
        <LocaleContextProvider>
            <SidebarLinks
                onLinkClick={() => {}}
                insets={fakeInsets}
                onAvatarClick={() => {}}
                isSmallScreenWidth={false}
            />
        </LocaleContextProvider>
    ));
}

// Icons need to be explicitly mocked. The testing library throws an error when trying to render them
jest.mock('../../src/components/Icon/Expensicons', () => ({
    MagnifyingGlass: () => '',
    Pencil: () => '',
    Pin: () => '',
}));

describe('Sidebar', () => {
    beforeAll(() => Onyx.init({
        keys: ONYXKEYS,
        registerStorageEventListener: () => {},
    }));

    // Initialize the network key for OfflineWithFeedback
    beforeEach(() => Onyx.merge(ONYXKEYS.NETWORK, {isOffline: false}));

    // Clear out Onyx after each test so that each test starts with a clean slate
    afterEach(() => {
        cleanup();
        Onyx.clear();
    });

    describe('in default mode', () => {
        // Clear out Onyx after each test so that each test starts with a clean slate
        afterEach(Onyx.clear);

        test('is not rendered when there are no props passed to it', () => {
            // GIVEN all the default props are passed to SidebarLinks
            // WHEN it is rendered
            const sidebarLinks = getDefaultRenderedSidebarLinks();

            // THEN it should render nothing and be null
            // This is expected because there is an early return when there are no personal details
            expect(sidebarLinks.toJSON()).toBe(null);
        });

        test('is rendered with an empty list when personal details exist', () => {
            // GIVEN the sidebar is rendered with default props
            const sidebarLinks = getDefaultRenderedSidebarLinks();

            return waitForPromisesToResolve()

                // WHEN Onyx is updated with some personal details
                .then(() => Onyx.multiSet({
                    [ONYXKEYS.PERSONAL_DETAILS]: LHNTestUtils.fakePersonalDetails,
                }))

                // THEN the component should be rendered with an empty list since it will get past the early return
                .then(() => {
                    expect(sidebarLinks.toJSON()).not.toBe(null);
                    expect(sidebarLinks.queryAllByA11yHint('Navigates to a chat')).toHaveLength(0);
                });
        });

        test('contains one report when a report is in Onyx', () => {
            // GIVEN the sidebar is rendered in default mode (most recent first)
            // while currently viewing report 1
            const sidebarLinks = getDefaultRenderedSidebarLinks();

            return waitForPromisesToResolve()

                // WHEN Onyx is updated with some personal details and a report
                .then(() => Onyx.multiSet({
                    [ONYXKEYS.NVP_PRIORITY_MODE]: CONST.PRIORITY_MODE.DEFAULT,
                    [ONYXKEYS.PERSONAL_DETAILS]: LHNTestUtils.fakePersonalDetails,
                    [`${ONYXKEYS.COLLECTION.REPORT}${report.reportID}`]: report,
                }))

                // THEN the component should be rendered with an item for the fake report
                .then(() => {
                    expect(sidebarLinks.queryAllByText('One, Two')).toHaveLength(1);
                });
        });

        test('orders items with most recently updated on top', () => {
            // GIVEN the sidebar is rendered in default mode (most recent first)
            // while currently viewing report 1
            const sidebarLinks = getDefaultRenderedSidebarLinks('1');
            return waitForPromisesToResolve()

                // WHEN Onyx is updated with some personal details and multiple reports
                .then(() => Onyx.multiSet({
                    [ONYXKEYS.NVP_PRIORITY_MODE]: 'default',
                    [ONYXKEYS.PERSONAL_DETAILS]: fakePersonalDetails,
                    [`${ONYXKEYS.COLLECTION.REPORT}1`]: fakeReport1,
                    [`${ONYXKEYS.COLLECTION.REPORT}2`]: fakeReport2,
                    [`${ONYXKEYS.COLLECTION.REPORT}3`]: fakeReport3,
                    [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}1`]: fakeReport1Actions,
                    [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}2`]: fakeReport2Actions,
                    [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}2`]: fakeReport3Actions,
                }))

                // THEN the component should be rendered with the mostly recently updated report first
                .then(() => {
                    const displayNames = sidebarLinks.queryAllByA11yLabel('Chat user display names');
                    expect(displayNames).toHaveLength(3);
                    expect(lodashGet(displayNames, [0, 'props', 'children'])).toBe('Five, Six');
                    expect(lodashGet(displayNames, [1, 'props', 'children'])).toBe('Three, Four');
                    expect(lodashGet(displayNames, [2, 'props', 'children'])).toBe('One, Two');
                });
        });

        it('changes the order when adding a draft to the active report', () => {
            // Given three reports in the recently updated order of 3, 2, 1
            // And the first report has a draft
            // And the currently viewed report is the first report
            const report1 = {
                ...LHNTestUtils.getFakeReport(['email1@test.com', 'email2@test.com'], 3),
                hasDraft: true,
            };
            const report2 = LHNTestUtils.getFakeReport(['email3@test.com', 'email4@test.com'], 2);
            const report3 = LHNTestUtils.getFakeReport(['email5@test.com', 'email6@test.com'], 1);
            const reportIDFromRoute = report1.reportID;
            const sidebarLinks = LHNTestUtils.getDefaultRenderedSidebarLinks(reportIDFromRoute);
            return waitForPromisesToResolve()

                // GIVEN the sidebar is rendered in default mode (most recent first)
                // while currently viewing report 1
                // with reports in top-to-bottom order of 3 > 2 > 1
                .then(() => Onyx.multiSet({
                    [ONYXKEYS.NVP_PRIORITY_MODE]: 'default',
                    [ONYXKEYS.PERSONAL_DETAILS]: fakePersonalDetails,
                    [`${ONYXKEYS.COLLECTION.REPORT}1`]: fakeReport1,
                    [`${ONYXKEYS.COLLECTION.REPORT}2`]: fakeReport2,
                    [`${ONYXKEYS.COLLECTION.REPORT}3`]: fakeReport3,
                    [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}1`]: fakeReport1Actions,
                    [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}2`]: fakeReport2Actions,
                    [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}2`]: fakeReport3Actions,
                }))

                // Then there should be a pencil icon and report one should be the first one because putting a draft on the active report should change its location
                // in the ordered list
                .then(() => {
                    const pencilIcon = sidebarLinks.getAllByAccessibilityHint('Pencil Icon');
                    expect(pencilIcon).toHaveLength(1);

                    const displayNames = sidebarLinks.queryAllByA11yLabel('Chat user display names');
                    expect(displayNames).toHaveLength(3);
                    expect(lodashGet(displayNames, [0, 'props', 'children'])).toBe('One, Two'); // this has `hasDraft` flag enabled so it will be on top
                    expect(lodashGet(displayNames, [1, 'props', 'children'])).toBe('Five, Six');
                    expect(lodashGet(displayNames, [2, 'props', 'children'])).toBe('Three, Four');
                });
        });

        it('reorders the reports to always have the most recently updated one on top', () => {
            const sidebarLinks = LHNTestUtils.getDefaultRenderedSidebarLinks();

            // Given three reports in the recently updated order of 3, 2, 1
            const report1 = LHNTestUtils.getFakeReport(['email1@test.com', 'email2@test.com'], 3);
            const report2 = LHNTestUtils.getFakeReport(['email3@test.com', 'email4@test.com'], 2);
            const report3 = LHNTestUtils.getFakeReport(['email5@test.com', 'email6@test.com'], 1);

            return waitForPromisesToResolve()

                // When Onyx is updated with the data and the sidebar re-renders
                .then(() => Onyx.multiSet({
                    [ONYXKEYS.NVP_PRIORITY_MODE]: CONST.PRIORITY_MODE.DEFAULT,
                    [ONYXKEYS.PERSONAL_DETAILS]: LHNTestUtils.fakePersonalDetails,
                    [`${ONYXKEYS.COLLECTION.REPORT}${report1.reportID}`]: report1,
                    [`${ONYXKEYS.COLLECTION.REPORT}${report2.reportID}`]: report2,
                    [`${ONYXKEYS.COLLECTION.REPORT}${report3.reportID}`]: report3,
                }))

                // When a new comment is added to report 1 (eg. it's lastMessageTimestamp is updated)
                .then(() => Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${report1.reportID}`, {lastMessageTimestamp: Date.now()}))

                // Then the order of the reports should be 1 > 3 > 2
                //                                         ^--- (1 goes to the front and pushes other two down)
                .then(() => {
                    const displayNames = sidebarLinks.queryAllByA11yLabel('Chat user display names');
                    expect(displayNames).toHaveLength(3);
                    expect(lodashGet(displayNames, [0, 'props', 'children'])).toBe('One, Two');
                    expect(lodashGet(displayNames, [1, 'props', 'children'])).toBe('Five, Six');
                    expect(lodashGet(displayNames, [2, 'props', 'children'])).toBe('Three, Four');
                });
        });

        it('reorders the reports to keep draft reports on top', () => {
            // Given three reports in the recently updated order of 3, 2, 1
            // And the second report has a draft
            // And the currently viewed report is the second report
            const report1 = LHNTestUtils.getFakeReport(['email1@test.com', 'email2@test.com'], 3);
            const report2 = {
                ...LHNTestUtils.getFakeReport(['email3@test.com', 'email4@test.com'], 2),
                hasDraft: true,
            };
            const report3 = LHNTestUtils.getFakeReport(['email5@test.com', 'email6@test.com'], 1);
            const reportIDFromRoute = report2.reportID;
            let sidebarLinks = LHNTestUtils.getDefaultRenderedSidebarLinks(reportIDFromRoute);

            return waitForPromisesToResolve()

                // GIVEN the sidebar is rendered in default mode (most recent first)
                // while currently viewing report 2 (the one in the middle)
                // with a draft on report 2
                // with reports in top-to-bottom order of 3 > 2 > 1
                .then(() => Onyx.multiSet({
                    [ONYXKEYS.NVP_PRIORITY_MODE]: CONST.PRIORITY_MODE.DEFAULT,
                    [ONYXKEYS.PERSONAL_DETAILS]: LHNTestUtils.fakePersonalDetails,
                    [`${ONYXKEYS.COLLECTION.REPORT}${report1.reportID}`]: report1,
                    [`${ONYXKEYS.COLLECTION.REPORT}${report2.reportID}`]: report2,
                    [`${ONYXKEYS.COLLECTION.REPORT}${report3.reportID}`]: report3,
                }))

                // WHEN the currently active chat is switched to report 1 (the one on the bottom)
                .then(() => Onyx.merge(ONYXKEYS.CURRENTLY_VIEWED_REPORTID, '1'))

                // THEN the order of the reports should be 2 > 3 > 1
                //                                         ^--- (2 goes to the front and pushes 3 down)
                .then(() => {
                    const displayNames = sidebarLinks.queryAllByA11yLabel('Chat user display names');
                    expect(displayNames).toHaveLength(3);
                    expect(lodashGet(displayNames, [0, 'props', 'children'])).toBe('Three, Four');
                    expect(lodashGet(displayNames, [1, 'props', 'children'])).toBe('Five, Six');
                    expect(lodashGet(displayNames, [2, 'props', 'children'])).toBe('One, Two');
                });
        });

        test('removes the pencil icon when draft is removed', () => {
            const sidebarLinks = getDefaultRenderedSidebarLinks('2');
            return waitForPromisesToResolve()

                // GIVEN the sidebar is rendered in default mode (most recent first)
                // while currently viewing report 2 (the one in the middle)
                // with a draft on report 2
                // with reports in top-to-bottom order of 3 > 2 > 1
                .then(() => Onyx.multiSet({
                    [ONYXKEYS.NVP_PRIORITY_MODE]: 'default',
                    [ONYXKEYS.PERSONAL_DETAILS]: fakePersonalDetails,
                    [`${ONYXKEYS.COLLECTION.REPORT}1`]: fakeReport1,
                    [`${ONYXKEYS.COLLECTION.REPORT}2`]: {hasDraft: true, ...fakeReport2},
                    [`${ONYXKEYS.COLLECTION.REPORT}3`]: fakeReport3,
                    [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}1`]: fakeReport1Actions,
                    [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}2`]: fakeReport2Actions,
                    [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}2`]: fakeReport3Actions,
                }))

                // Then there should be a pencil icon showing
                .then(() => {
                    expect(sidebarLinks.getAllByAccessibilityHint('Pencil Icon')).toHaveLength(1);
                })

                // WHEN the draft on report 2 is removed
                .then(() => Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}2`, {hasDraft: null}))

                // THEN the pencil icon goes away
                .then(() => {
                    expect(sidebarLinks.queryAllByAccessibilityHint('Pencil Icon')).toHaveLength(0);
                });
        });

        test('removes the pin icon when chat is unpinned', () => {
            const sidebarLinks = getDefaultRenderedSidebarLinks('2');
            return waitForPromisesToResolve()

                // GIVEN the sidebar is rendered in default mode (most recent first)
                // while currently viewing report 2 (the one in the middle)
                // with report 2 pinned
                .then(() => Onyx.multiSet({
                    [ONYXKEYS.NVP_PRIORITY_MODE]: 'default',
                    [ONYXKEYS.PERSONAL_DETAILS]: fakePersonalDetails,
                    [`${ONYXKEYS.COLLECTION.REPORT}1`]: fakeReport1,
                    [`${ONYXKEYS.COLLECTION.REPORT}2`]: {...fakeReport2, isPinned: true},
                    [`${ONYXKEYS.COLLECTION.REPORT}3`]: fakeReport3,
                    [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}1`]: fakeReport1Actions,
                    [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}2`]: fakeReport2Actions,
                    [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}2`]: fakeReport3Actions,
                }))

                // Then there should be a pencil icon showing
                .then(() => {
                    expect(sidebarLinks.getAllByAccessibilityHint('Pin Icon')).toHaveLength(1);
                })

                // WHEN the chat is unpinned
                .then(() => Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}2`, {isPinned: false}))

                // THEN the pencil icon goes away
                .then(() => {
                    expect(sidebarLinks.queryAllByAccessibilityHint('Pin Icon')).toHaveLength(0);
                });
        });

        test('puts draft reports at the top when the page refreshes', () => {
            getDefaultRenderedSidebarLinks();
            let sidebarAfterRefresh;

            return waitForPromisesToResolve()

                // GIVEN the sidebar is rendered in default mode (most recent first)
                // while currently viewing report 2 (the one in the middle)
                // with a draft on report 2
                // with reports in top-to-bottom order of 3 > 2 > 1
                .then(() => Onyx.multiSet({
                    [ONYXKEYS.NVP_PRIORITY_MODE]: 'default',
                    [ONYXKEYS.PERSONAL_DETAILS]: fakePersonalDetails,
                    [ONYXKEYS.CURRENTLY_VIEWED_REPORTID]: '2',
                    [`${ONYXKEYS.COLLECTION.REPORT}1`]: fakeReport1,
                    [`${ONYXKEYS.COLLECTION.REPORT}2`]: {hasDraft: true, ...fakeReport2},
                    [`${ONYXKEYS.COLLECTION.REPORT}3`]: fakeReport3,
                    [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}1`]: fakeReport1Actions,
                    [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}2`]: fakeReport2Actions,
                    [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}2`]: fakeReport3Actions,
                }))

                // WHEN the sidebar is re-rendered from scratch, simulating a page refresh
                // because data is still in Onyx
                .then(() => {
                    sidebarAfterRefresh = getDefaultRenderedSidebarLinks();

                    // ensures rendering is done
                    return waitForPromisesToResolve();
                })

                // THEN the reports are in the order 2 > 3 > 1
                //                                   ^--- (2 goes to the front and pushes 3 down)
                .then(() => {
                    const reportOptions = sidebarAfterRefresh.getAllByText(/ReportID, (One|Two|Three)/);
                    expect(reportOptions).toHaveLength(3);
                    expect(reportOptions[0].children[0].props.children).toBe('ReportID, Two');
                    expect(reportOptions[1].children[0].props.children).toBe('ReportID, Three');
                    expect(reportOptions[2].children[0].props.children).toBe('ReportID, One');
                });
        });

        it('sorts chats by pinned > IOU > draft', () => {
            const sidebarLinks = getDefaultRenderedSidebarLinks();

            return waitForPromisesToResolve()

                // GIVEN the sidebar is rendered in default mode (most recent first)
                // while currently viewing report 2 (the one in the middle)
                // with a draft on report 2
                // with the current user set to email9@
                // with a report that has a draft, a report that is pinned, and
                //    an outstanding IOU report that doesn't belong to the current user
                .then(() => Onyx.multiSet({
                    [ONYXKEYS.NVP_PRIORITY_MODE]: CONST.PRIORITY_MODE.DEFAULT,
                    [ONYXKEYS.PERSONAL_DETAILS]: LHNTestUtils.fakePersonalDetails,
                    [`${ONYXKEYS.COLLECTION.REPORT}${report1.reportID}`]: report1,
                    [`${ONYXKEYS.COLLECTION.REPORT}${report2.reportID}`]: report2,
                    [`${ONYXKEYS.COLLECTION.REPORT}${report3.reportID}`]: report3,
                }))

                // THEN the reports are ordered by IOU > Pinned > Draft
                // there is a pencil icon
                // there is a pinned icon
                // there is an IOU badge
                .then(() => {
                    const displayNames = sidebarLinks.queryAllByA11yLabel('Chat user display names');
                    expect(displayNames).toHaveLength(3);
                    expect(lodashGet(displayNames, [0, 'props', 'children'])).toBe('Five, Six');
                    expect(lodashGet(displayNames, [1, 'props', 'children'])).toBe('One, Two');
                    expect(lodashGet(displayNames, [2, 'props', 'children'])).toBe('Three, Four');
                })

                // When a new report is added
                .then(() => Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}4`, {
                    reportID: '4',
                    reportName: 'Report Four',
                    maxSequenceNumber: TEST_MAX_SEQUENCE_NUMBER,
                    isPinned: true,
                    lastMessageTimestamp: Date.now(),
                    participants: ['email7@test.com', 'email8@test.com'],
                }))

                // Then they are still in alphabetical order
                .then(() => {
                    const displayNames = sidebarLinks.queryAllByA11yLabel('Chat user display names');
                    expect(displayNames).toHaveLength(4);
                    expect(lodashGet(displayNames, [0, 'props', 'children'])).toBe('Five, Six');
                    expect(lodashGet(displayNames, [1, 'props', 'children'])).toBe('One, Two');
                    expect(lodashGet(displayNames, [2, 'props', 'children'])).toBe('Seven, Eight');
                    expect(lodashGet(displayNames, [3, 'props', 'children'])).toBe('Three, Four');
                });
        });

        it('alphabetizes all the chats that have drafts', () => {
            // Given three reports in the recently updated order of 3, 2, 1
            // and they all have drafts
            const report1 = {
                ...LHNTestUtils.getFakeReport(['email1@test.com', 'email2@test.com'], 3),
                hasDraft: true,
            };
            const report2 = {
                ...LHNTestUtils.getFakeReport(['email3@test.com', 'email4@test.com'], 2),
                hasDraft: true,
            };
            const report3 = {
                ...LHNTestUtils.getFakeReport(['email5@test.com', 'email6@test.com'], 1),
                hasDraft: true,
            };
            const report4 = {
                ...LHNTestUtils.getFakeReport(['email7@test.com', 'email8@test.com'], 0),
                hasDraft: true,
            };
            const sidebarLinks = LHNTestUtils.getDefaultRenderedSidebarLinks('0');
            return waitForPromisesToResolve()

                // When Onyx is updated with the data and the sidebar re-renders
                .then(() => Onyx.multiSet({
                    [ONYXKEYS.NVP_PRIORITY_MODE]: CONST.PRIORITY_MODE.DEFAULT,
                    [ONYXKEYS.PERSONAL_DETAILS]: LHNTestUtils.fakePersonalDetails,
                    [`${ONYXKEYS.COLLECTION.REPORT}${report1.reportID}`]: report1,
                    [`${ONYXKEYS.COLLECTION.REPORT}${report2.reportID}`]: report2,
                    [`${ONYXKEYS.COLLECTION.REPORT}${report3.reportID}`]: report3,
                }))

                // Then the reports are in alphabetical order
                .then(() => {
                    const displayNames = sidebarLinks.queryAllByA11yLabel('Chat user display names');
                    expect(displayNames).toHaveLength(3);
                    expect(lodashGet(displayNames, [0, 'props', 'children'])).toBe('Five, Six');
                    expect(lodashGet(displayNames, [1, 'props', 'children'])).toBe('One, Two');
                    expect(lodashGet(displayNames, [2, 'props', 'children'])).toBe('Three, Four');
                })

                // When a new report is added
                .then(() => Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}4`, {
                    reportID: '4',
                    reportName: 'Report Four',
                    maxSequenceNumber: TEST_MAX_SEQUENCE_NUMBER,
                    hasDraft: true,
                    lastMessageTimestamp: Date.now(),
                    participants: ['email7@test.com', 'email8@test.com'],
                }))

                // Then they are still in alphabetical order
                .then(() => {
                    const displayNames = sidebarLinks.queryAllByA11yLabel('Chat user display names');
                    expect(displayNames).toHaveLength(4);
                    expect(lodashGet(displayNames, [0, 'props', 'children'])).toBe('Five, Six');
                    expect(lodashGet(displayNames, [1, 'props', 'children'])).toBe('One, Two');
                    expect(lodashGet(displayNames, [2, 'props', 'children'])).toBe('Seven, Eight');
                    expect(lodashGet(displayNames, [3, 'props', 'children'])).toBe('Three, Four');
                });
        });

        it('puts archived chats last', () => {
            // Given three reports, with the first report being archived
            const report1 = {
                ...LHNTestUtils.getFakeReport(['email1@test.com', 'email2@test.com']),
                chatType: CONST.REPORT.CHAT_TYPE.POLICY_ROOM,
                statusNum: CONST.REPORT.STATUS.CLOSED,
                stateNum: CONST.REPORT.STATE_NUM.SUBMITTED,
            };
            const report2 = LHNTestUtils.getFakeReport(['email3@test.com', 'email4@test.com']);
            const report3 = LHNTestUtils.getFakeReport(['email5@test.com', 'email6@test.com']);

            // Given the user is in all betas
            const betas = [
                CONST.BETAS.DEFAULT_ROOMS,
                CONST.BETAS.POLICY_ROOMS,
                CONST.BETAS.POLICY_EXPENSE_CHAT,
            ];
            const sidebarLinks = LHNTestUtils.getDefaultRenderedSidebarLinks('0');
            return waitForPromisesToResolve()

                // When Onyx is updated with the data and the sidebar re-renders
                .then(() => Onyx.multiSet({
                    [ONYXKEYS.BETAS]: betas,
                    [ONYXKEYS.NVP_PRIORITY_MODE]: CONST.PRIORITY_MODE.DEFAULT,
                    [ONYXKEYS.PERSONAL_DETAILS]: LHNTestUtils.fakePersonalDetails,
                    [`${ONYXKEYS.COLLECTION.REPORT}${report1.reportID}`]: report1,
                    [`${ONYXKEYS.COLLECTION.REPORT}${report2.reportID}`]: report2,
                    [`${ONYXKEYS.COLLECTION.REPORT}${report3.reportID}`]: report3,
                }))

                // Then the first report is in last position
                .then(() => {
                    const displayNames = sidebarLinks.queryAllByA11yLabel('Chat user display names');
                    expect(displayNames).toHaveLength(3);
                    expect(lodashGet(displayNames, [0, 'props', 'children'])).toBe('Five, Six');
                    expect(lodashGet(displayNames, [1, 'props', 'children'])).toBe('Three, Four');
                    expect(lodashGet(displayNames, [2, 'props', 'children'])).toBe('Report (archived)');
                });
        });
    });

    describe('in #focus mode', () => {
        it('hides unread chats', () => {
            let sidebarLinks = getDefaultRenderedSidebarLinks('1');
            return waitForPromisesToResolve()

                // GIVEN the sidebar is rendered in #focus mode (hides read chats)
                // with report 1 and 2 having unread actions
                .then(() => Onyx.multiSet({
                    [ONYXKEYS.NVP_PRIORITY_MODE]: 'gsd',
                    [ONYXKEYS.PERSONAL_DETAILS]: fakePersonalDetails,
                    [ONYXKEYS.CURRENTLY_VIEWED_REPORTID]: '1',
                    [`${ONYXKEYS.COLLECTION.REPORT}1`]: {...fakeReport1, unreadActionCount: 1},
                    [`${ONYXKEYS.COLLECTION.REPORT}2`]: {...fakeReport2, unreadActionCount: 1},
                    [`${ONYXKEYS.COLLECTION.REPORT}3`]: fakeReport3,
                    [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}1`]: fakeReport1Actions,
                    [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}2`]: fakeReport2Actions,
                    [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}2`]: fakeReport3Actions,
                }))

                // THEN the reports 1 and 2 are shown and 3 is not
                .then(() => {
                    const reportOptions = sidebarLinks.queryAllByText(/ReportID, /);
                    expect(reportOptions).toHaveLength(2);
                    expect(reportOptions[0].children[0].props.children).toBe('ReportID, One');
                    expect(reportOptions[1].children[0].props.children).toBe('ReportID, Two');
                })

                // WHEN report3 becomes unread
                .then(() => Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}3`, {unreadActionCount: 1}))

                // THEN all three chats are showing
                .then(() => {
                    expect(sidebarLinks.queryAllByText(/ReportID, /)).toHaveLength(3);
                })

                // WHEN report 1 becomes read (it's the active report)
                .then(() => Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}1`, {unreadActionCount: 0}))

                // THEN all three chats are still showing
                .then(() => {
                    expect(sidebarLinks.queryAllByText(/ReportID, /)).toHaveLength(3);
                })

                // WHEN report 2 becomes the active report
                .then(() => Onyx.merge(ONYXKEYS.CURRENTLY_VIEWED_REPORTID, '2'))

                // THEN report 1 should now disappear
                .then(() => {
                    expect(sidebarLinks.queryAllByText(/ReportID, /)).toHaveLength(2);
                    expect(sidebarLinks.queryAllByText(/ReportID, One/)).toHaveLength(0);
                });
        });

        it('alphabetizes chats', () => {
            const sidebarLinks = getDefaultRenderedSidebarLinks('1');
            return waitForPromisesToResolve()

                // GIVEN the sidebar is rendered in #focus mode (hides read chats)
                // with all reports having unread chats
                .then(() => Onyx.multiSet({
                    [ONYXKEYS.NVP_PRIORITY_MODE]: 'gsd',
                    [ONYXKEYS.PERSONAL_DETAILS]: fakePersonalDetails,
                    [ONYXKEYS.CURRENTLY_VIEWED_REPORTID]: '1',
                    [`${ONYXKEYS.COLLECTION.REPORT}1`]: {...fakeReport1, unreadActionCount: 1},
                    [`${ONYXKEYS.COLLECTION.REPORT}2`]: {...fakeReport2, unreadActionCount: 1},
                    [`${ONYXKEYS.COLLECTION.REPORT}3`]: {...fakeReport3, unreadActionCount: 1},
                    [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}1`]: fakeReport1Actions,
                    [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}2`]: fakeReport2Actions,
                    [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}2`]: fakeReport3Actions,
                }))

                // THEN the reports are in alphabetical order
                .then(() => {
                    const displayNames = sidebarLinks.queryAllByA11yLabel('Chat user display names');
                    expect(displayNames).toHaveLength(3);
                    expect(lodashGet(displayNames, [0, 'props', 'children'])).toBe('Five, Six');
                    expect(lodashGet(displayNames, [1, 'props', 'children'])).toBe('One, Two');
                    expect(lodashGet(displayNames, [2, 'props', 'children'])).toBe('Three, Four');
                })

                // WHEN a new report is added
                .then(() => Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}4`, {
                    reportID: '4',
                    reportName: 'Report Four',
                    unreadActionCount: 1,
                    lastMessageTimestamp: Date.now(),
                    participants: ['email7@test.com', 'email8@test.com'],
                }))

                // THEN they are still in alphabetical order
                .then(() => {
                    const displayNames = sidebarLinks.queryAllByA11yLabel('Chat user display names');
                    expect(displayNames).toHaveLength(4);
                    expect(lodashGet(displayNames, [0, 'props', 'children'])).toBe('Five, Six');
                    expect(lodashGet(displayNames, [1, 'props', 'children'])).toBe('One, Two');
                    expect(lodashGet(displayNames, [2, 'props', 'children'])).toBe('Seven, Eight');
                    expect(lodashGet(displayNames, [3, 'props', 'children'])).toBe('Three, Four');
                });
        });

        it('puts archived chats last', () => {
            // Given three unread reports, with the first report being archived
            const report1 = {
                ...LHNTestUtils.getFakeReport(['email1@test.com', 'email2@test.com'], 3),
                lastReadSequenceNumber: LHNTestUtils.TEST_MAX_SEQUENCE_NUMBER - 1,
                chatType: CONST.REPORT.CHAT_TYPE.POLICY_ROOM,
                statusNum: CONST.REPORT.STATUS.CLOSED,
                stateNum: CONST.REPORT.STATE_NUM.SUBMITTED,
            };
            const report2 = {
                ...LHNTestUtils.getFakeReport(['email3@test.com', 'email4@test.com'], 2),
                lastReadSequenceNumber: LHNTestUtils.TEST_MAX_SEQUENCE_NUMBER - 1,
            };
            const report3 = {
                ...LHNTestUtils.getFakeReport(['email5@test.com', 'email6@test.com'], 1),
                lastReadSequenceNumber: LHNTestUtils.TEST_MAX_SEQUENCE_NUMBER - 1,
            };

            // Given the user is in all betas
            const betas = [
                CONST.BETAS.DEFAULT_ROOMS,
                CONST.BETAS.POLICY_ROOMS,
                CONST.BETAS.POLICY_EXPENSE_CHAT,
            ];
            const sidebarLinks = LHNTestUtils.getDefaultRenderedSidebarLinks('0');
            return waitForPromisesToResolve()

                // When Onyx is updated with the data and the sidebar re-renders
                .then(() => Onyx.multiSet({
                    [ONYXKEYS.BETAS]: betas,
                    [ONYXKEYS.NVP_PRIORITY_MODE]: CONST.PRIORITY_MODE.GSD,
                    [ONYXKEYS.PERSONAL_DETAILS]: LHNTestUtils.fakePersonalDetails,
                    [`${ONYXKEYS.COLLECTION.REPORT}${report1.reportID}`]: report1,
                    [`${ONYXKEYS.COLLECTION.REPORT}${report2.reportID}`]: report2,
                    [`${ONYXKEYS.COLLECTION.REPORT}${report3.reportID}`]: report3,
                }))

                // Then the first report is in last position
                .then(() => {
                    const displayNames = sidebarLinks.queryAllByA11yLabel('Chat user display names');
                    expect(displayNames).toHaveLength(3);
                    expect(lodashGet(displayNames, [0, 'props', 'children'])).toBe('Five, Six');
                    expect(lodashGet(displayNames, [1, 'props', 'children'])).toBe('Three, Four');
                    expect(lodashGet(displayNames, [2, 'props', 'children'])).toBe('Report (archived)');
                });
        });
    });
});