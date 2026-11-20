import React, { useState, useEffect } from "react";
import History from "./history.jsx";

export default function App({ provider }) {
  const { path } = provider;
  const [versions, loading, error, loadMore] = useVersionsLoader(provider);

  if (error) {
    return <ErrorMessage error={error} />;
  }

  if (!versions && loading) {
    return (
      <Center>
        <p>
          Loading <strong>{path}</strong> history...
        </p>
      </Center>
    );
  }

  if (!versions.length) {
    return (
      <Center>
        <p>No history found for this file.</p>
      </Center>
    );
  }

  return <History versions={versions} loadMore={loadMore} />;
}

function Center({ children }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        padding: "0 40px"
      }}
    >
      {children}
    </div>
  );
}

function ErrorMessage({ error }) {
  if (!error.friendly) {
    console.error(error);
  }
  return (
    <Center>
      <p>
        {error.friendly
          ? error.message
          : "Unexpected error. Check the console."}
      </p>
    </Center>
  );
}

function useVersionsLoader(provider) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
    last: 10,
    noMore: false
  });

  const loadMore = () => {
    setState(old => {
      const shouldFetchMore = !old.loading && !old.noMore;
      return shouldFetchMore
        ? { ...old, last: old.last + 10, loading: true }
        : old;
    });
  };

  useEffect(() => {
    let cancelled = false;
    provider
      .getVersions(state.last)
      .then(data => {
        if (cancelled) return;
        setState(old => ({
          data,
          loading: false,
          error: false,
          last: old.last,
          noMore: data.length < old.last
        }));
      })
      .catch(error => {
        if (cancelled) return;
        setState(old => ({
          ...old,
          loading: false,
          error: error.friendly ? error : error.message || String(error)
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [provider, state.last]);

  return [state.data, state.loading, state.error, loadMore];
}
