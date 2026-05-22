export const POST_BOOST_CONFIRM_WAIT_MS = 1000;

export function waitPostBoostConfirmDelay(ms = POST_BOOST_CONFIRM_WAIT_MS): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
